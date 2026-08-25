import type { CreateProductEventRequest } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import {
	createProductEventEmitter,
	getProductEventSessionState,
} from "./product-events";

const FIRST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";

function createStorage() {
	const values = new Map<string, string>();

	return {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			values.set(key, value);
		}),
	};
}

function createRuntime() {
	const capture = vi.fn();
	const createIdempotencyKey = vi
		.fn<() => string>()
		.mockReturnValueOnce(FIRST_ID)
		.mockReturnValueOnce(SECOND_ID);
	const persist = vi.fn<(request: CreateProductEventRequest) => Promise<void>>(
		() => Promise.resolve(),
	);
	const resolveHasSession = vi.fn<() => Promise<boolean>>(() =>
		Promise.resolve(false),
	);
	const storage = createStorage();

	return {
		capture,
		createIdempotencyKey,
		getSessionStorage: () => storage,
		persist,
		resolveHasSession,
		storage,
	};
}

describe("product event emitter", () => {
	it("distinguishes pending, authenticated, and anonymous sessions", () => {
		expect(getProductEventSessionState(true, undefined)).toBe("pending");
		expect(getProductEventSessionState(false, "user-1")).toBe("authenticated");
		expect(getProductEventSessionState(false, undefined)).toBe("anonymous");
	});

	it("mirrors anonymous events to analytics without attempting persistence", async () => {
		const runtime = createRuntime();
		const emitter = createProductEventEmitter(runtime);

		await emitter.upgradeClicked(
			{ method: "card", surface: "marketing_pricing" },
			"anonymous",
		);

		expect(runtime.capture).toHaveBeenCalledWith("upgrade_clicked", {
			method: "card",
			surface: "marketing_pricing",
		});
		expect(runtime.createIdempotencyKey).not.toHaveBeenCalled();
		expect(runtime.persist).not.toHaveBeenCalled();
		expect(runtime.resolveHasSession).not.toHaveBeenCalled();
	});

	it("persists authenticated events with a fresh UUID on every click", async () => {
		const runtime = createRuntime();
		const emitter = createProductEventEmitter(runtime);

		await Promise.all([
			emitter.upgradeClicked(
				{ method: "card", surface: "workspace_header" },
				"authenticated",
			),
			emitter.upgradeClicked(
				{ method: "offline", surface: "workspace_header" },
				"authenticated",
			),
		]);

		expect(runtime.capture).toHaveBeenCalledTimes(2);
		expect(runtime.persist).toHaveBeenNthCalledWith(1, {
			idempotencyKey: FIRST_ID,
			kind: "upgrade_clicked",
			properties: { method: "card" },
			surface: "workspace_header",
		});
		expect(runtime.persist).toHaveBeenNthCalledWith(2, {
			idempotencyKey: SECOND_ID,
			kind: "upgrade_clicked",
			properties: { method: "offline" },
			surface: "workspace_header",
		});
	});

	it("deduplicates pricing views once per session-storage surface", () => {
		const runtime = createRuntime();
		const emitter = createProductEventEmitter(runtime);

		emitter.pricingViewed("marketing_pricing", "authenticated");
		emitter.pricingViewed("marketing_pricing", "authenticated");
		emitter.pricingViewed("plan_picker", "authenticated");

		expect(runtime.capture).toHaveBeenCalledTimes(2);
		expect(runtime.persist).toHaveBeenCalledTimes(2);
		expect(runtime.storage.setItem).toHaveBeenNthCalledWith(
			1,
			"pe:pricing_viewed:marketing_pricing",
			"1",
		);
		expect(runtime.storage.setItem).toHaveBeenNthCalledWith(
			2,
			"pe:pricing_viewed:plan_picker",
			"1",
		);
	});

	it("swallows analytics, storage, UUID, and persistence failures", async () => {
		const rejectedPersistence = createRuntime();
		rejectedPersistence.capture.mockImplementation(() => {
			throw new Error("analytics unavailable");
		});
		rejectedPersistence.persist.mockRejectedValue(
			new Error("request unavailable"),
		);
		const rejectedEmitter = createProductEventEmitter(rejectedPersistence);

		await expect(
			rejectedEmitter.upgradeClicked(
				{ method: "card", surface: "sidebar" },
				"authenticated",
			),
		).resolves.toBeUndefined();

		const synchronousFailures = createRuntime();
		synchronousFailures.getSessionStorage = () => {
			throw new Error("storage unavailable");
		};
		synchronousFailures.createIdempotencyKey.mockImplementation(() => {
			throw new Error("crypto unavailable");
		});
		const synchronousEmitter = createProductEventEmitter(synchronousFailures);

		expect(() =>
			synchronousEmitter.pricingViewed("plan_picker", "authenticated"),
		).not.toThrow();
	});

	it("mirrors pending events immediately and persists after auth resolves", async () => {
		const runtime = createRuntime();
		let resolveSession: ((hasSession: boolean) => void) | undefined;
		runtime.resolveHasSession.mockReturnValueOnce(
			new Promise<boolean>((resolve) => {
				resolveSession = resolve;
			}),
		);
		const emitter = createProductEventEmitter(runtime);

		emitter.pricingViewed("marketing_pricing", "pending");
		emitter.pricingViewed("marketing_pricing", "authenticated");

		expect(runtime.capture).toHaveBeenCalledOnce();
		expect(runtime.persist).not.toHaveBeenCalled();
		resolveSession?.(true);
		await Promise.resolve();

		expect(runtime.persist).toHaveBeenCalledOnce();
		expect(runtime.persist).toHaveBeenCalledWith({
			idempotencyKey: FIRST_ID,
			kind: "pricing_viewed",
			surface: "marketing_pricing",
		});
	});

	it("does not persist a pending event when auth resolves anonymous", async () => {
		const runtime = createRuntime();
		runtime.resolveHasSession.mockResolvedValueOnce(false);
		const emitter = createProductEventEmitter(runtime);

		await emitter.upgradeClicked(
			{ method: "card", surface: "marketing_pricing" },
			"pending",
		);

		expect(runtime.capture).toHaveBeenCalledOnce();
		expect(runtime.persist).not.toHaveBeenCalled();
	});

	it("waits for authenticated persistence before resolving checkout tracking", async () => {
		const runtime = createRuntime();
		let resolvePersistence: (() => void) | undefined;
		runtime.persist.mockReturnValueOnce(
			new Promise<void>((resolve) => {
				resolvePersistence = resolve;
			}),
		);
		const emitter = createProductEventEmitter(runtime);
		let completed = false;

		const completion = emitter
			.upgradeClicked(
				{ method: "card", surface: "billing_page" },
				"authenticated",
			)
			.then(() => {
				completed = true;
			});

		await Promise.resolve();
		expect(runtime.persist).toHaveBeenCalledOnce();
		expect(completed).toBe(false);

		resolvePersistence?.();
		await completion;
		expect(completed).toBe(true);
	});

	it("falls back to in-memory dedup when session storage is unavailable", () => {
		const runtime = createRuntime();
		const emitter = createProductEventEmitter({
			...runtime,
			getSessionStorage: () => null,
		});

		emitter.pricingViewed("marketing_pricing", "authenticated");
		emitter.pricingViewed("marketing_pricing", "authenticated");

		expect(runtime.capture).toHaveBeenCalledOnce();
		expect(runtime.persist).toHaveBeenCalledOnce();
	});
});
