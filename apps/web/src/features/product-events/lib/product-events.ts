import { captureEvent } from "@wandit/analytics/browser";
import type {
	CreateProductEventRequest,
	ProductEventKind,
	ProductEventMethod,
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
		properties: {
			method?: ProductEventMethod;
			surface: ProductEventSurface;
		},
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
		properties: {
			method: ProductEventMethod;
			surface: ProductEventSurface;
		},
		sessionState: ProductEventSessionState,
	) => Promise<void>;
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

	const emit = async (
		kind: ProductEventKind,
		surface: ProductEventSurface,
		sessionState: ProductEventSessionState,
		method?: ProductEventMethod,
	): Promise<void> => {
		try {
			runtime.capture(kind, method ? { method, surface } : { surface });
		} catch {
			// Analytics is best-effort and must never affect the interaction.
		}

		const persist = async () => {
			try {
				const request: CreateProductEventRequest = {
					idempotencyKey: runtime.createIdempotencyKey(),
					kind,
					...(method ? { properties: { method } } : {}),
					surface,
				};

				await runtime.persist(request);
			} catch {
				// UUID generation and transport failures are best-effort too.
			}
		};

		if (sessionState === "authenticated") {
			await persist();
			return;
		}

		if (sessionState === "pending") {
			try {
				if (await runtime.resolveHasSession()) {
					await persist();
				}
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

			void emit("pricing_viewed", surface, sessionState);
		},
		upgradeClicked: ({ method, surface }, sessionState) =>
			emit("upgrade_clicked", surface, sessionState, method),
	};
}

const productEventEmitter = createProductEventEmitter();

export const emitPricingViewed = productEventEmitter.pricingViewed;
export const emitUpgradeClicked = productEventEmitter.upgradeClicked;
