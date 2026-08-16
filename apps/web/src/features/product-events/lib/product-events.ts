import { captureEvent } from "@wandit/analytics/browser";
import type {
	CreateProductEventRequest,
	ProductEventKind,
	ProductEventSurface,
} from "@wandit/contracts";

import { createProductEvent } from "../api/product-events.services";

const PRICING_VIEWED_STORAGE_PREFIX = "pe:pricing_viewed:";

type ProductEventStorage = Pick<Storage, "getItem" | "setItem">;

export type ProductEventSessionState =
	| "anonymous"
	| "authenticated"
	| "pending";

type ProductEventRuntime = {
	capture: (
		event: ProductEventKind,
		properties: { surface: ProductEventSurface },
	) => void;
	createIdempotencyKey: () => string;
	getSessionStorage: () => ProductEventStorage | null;
	persist: (request: CreateProductEventRequest) => Promise<void>;
	resolveHasSession: () => Promise<boolean>;
};

export type ProductEventEmitter = {
	pricingViewed: (
		surface: Extract<ProductEventSurface, "marketing_pricing" | "plan_picker">,
		sessionState: ProductEventSessionState,
	) => void;
	upgradeClicked: (
		surface: ProductEventSurface,
		sessionState: ProductEventSessionState,
	) => void;
};

const defaultRuntime: ProductEventRuntime = {
	capture: captureEvent,
	createIdempotencyKey: () => globalThis.crypto.randomUUID(),
	getSessionStorage: () => {
		try {
			return typeof window === "undefined" ? null : window.sessionStorage;
		} catch {
			return null;
		}
	},
	persist: createProductEvent,
	resolveHasSession: async () => {
		const { getSession } = await import("@/features/auth/lib/session");
		return Boolean(await getSession());
	},
};

export function getProductEventSessionState(
	isPending: boolean,
	userId: string | undefined,
): ProductEventSessionState {
	if (isPending) {
		return "pending";
	}

	return userId ? "authenticated" : "anonymous";
}

export function createProductEventEmitter(
	runtime: ProductEventRuntime = defaultRuntime,
): ProductEventEmitter {
	const emittedPricingViewKeys = new Set<string>();

	const emit = (
		kind: ProductEventKind,
		surface: ProductEventSurface,
		sessionState: ProductEventSessionState,
	) => {
		try {
			runtime.capture(kind, { surface });
		} catch {
			// Analytics is best-effort and must never affect the interaction.
		}

		const persist = () => {
			try {
				const request: CreateProductEventRequest = {
					idempotencyKey: runtime.createIdempotencyKey(),
					kind,
					surface,
				};

				void runtime.persist(request).catch(() => undefined);
			} catch {
				// UUID generation and synchronous transport failures are best-effort too.
			}
		};

		if (sessionState === "authenticated") {
			persist();
			return;
		}

		if (sessionState === "pending") {
			try {
				void runtime
					.resolveHasSession()
					.then((hasSession) => {
						if (hasSession) {
							persist();
						}
					})
					.catch(() => undefined);
			} catch {
				// Session resolution is best-effort and never delays the interaction.
			}
		}
	};

	return {
		pricingViewed: (surface, sessionState) => {
			const storageKey = `${PRICING_VIEWED_STORAGE_PREFIX}${surface}`;
			if (emittedPricingViewKeys.has(storageKey)) {
				return;
			}

			try {
				const storage = runtime.getSessionStorage();
				if (storage && storage.getItem(storageKey) !== null) {
					emittedPricingViewKeys.add(storageKey);
					return;
				}
				storage?.setItem(storageKey, "1");
			} catch {
				// Storage can be unavailable in privacy modes; still emit best-effort.
			}
			emittedPricingViewKeys.add(storageKey);

			emit("pricing_viewed", surface, sessionState);
		},
		upgradeClicked: (surface, sessionState) => {
			emit("upgrade_clicked", surface, sessionState);
		},
	};
}

const productEventEmitter = createProductEventEmitter();

export const emitPricingViewed = productEventEmitter.pricingViewed;
export const emitUpgradeClicked = productEventEmitter.upgradeClicked;
