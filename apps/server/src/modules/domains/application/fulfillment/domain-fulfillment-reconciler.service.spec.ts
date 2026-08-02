import { describe, expect, it, vi } from "vitest";

import {
	DOMAIN_FULFILLMENT_RECONCILIATION_BATCH_SIZE,
	DOMAIN_FULFILLMENT_RECONCILIATION_STALE_MS,
	type DomainFulfillmentReconcilerDependencies,
	DomainFulfillmentReconcilerService,
	type DomainFulfillmentReconciliationCandidate,
} from "./domain-fulfillment-reconciler.service";

const NOW = new Date("2026-08-01T12:00:00.000Z");
const STALE = new Date(
	NOW.getTime() - DOMAIN_FULFILLMENT_RECONCILIATION_STALE_MS,
);

function candidate(
	overrides: Partial<DomainFulfillmentReconciliationCandidate> = {},
): DomainFulfillmentReconciliationCandidate {
	return {
		domainId: "22222222-2222-4222-8222-222222222222",
		domainStatus: "registering",
		orderId: "11111111-1111-4111-8111-111111111111",
		orderStatus: "paid",
		updatedAt: STALE,
		...overrides,
	};
}

function setup(candidates: DomainFulfillmentReconciliationCandidate[]) {
	const findStalePurchaseCandidates = vi
		.fn<
			DomainFulfillmentReconcilerDependencies["findStalePurchaseCandidates"]
		>()
		.mockResolvedValue(candidates);
	const now = vi
		.fn<DomainFulfillmentReconcilerDependencies["now"]>()
		.mockReturnValue(NOW);
	const recoverPurchase = vi
		.fn<DomainFulfillmentReconcilerDependencies["recoverPurchase"]>()
		.mockResolvedValue({ id: "run_1" });
	const service = new DomainFulfillmentReconcilerService({
		findStalePurchaseCandidates,
		now,
		recoverPurchase,
	});

	return { findStalePurchaseCandidates, recoverPurchase, service };
}

describe("DomainFulfillmentReconcilerService", () => {
	it("uses the bounded 30-minute stale scan and ensures every eligible purchase", async () => {
		const registering = candidate();
		const configuring = candidate({
			domainId: "33333333-3333-4333-8333-333333333333",
			domainStatus: "configuring",
			orderId: "44444444-4444-4444-8444-444444444444",
			orderStatus: "fulfilling",
		});
		const activeNeedsHealing = candidate({
			domainId: "55555555-5555-4555-8555-555555555555",
			domainStatus: "active",
			orderId: "66666666-6666-4666-8666-666666666666",
			orderStatus: "fulfilling",
		});
		const { findStalePurchaseCandidates, recoverPurchase, service } = setup([
			registering,
			configuring,
			activeNeedsHealing,
		]);

		await expect(service.execute()).resolves.toEqual({
			ensured: 3,
			processed: true,
			scanned: 3,
			skipped: 0,
		});
		expect(findStalePurchaseCandidates).toHaveBeenCalledWith({
			limit: DOMAIN_FULFILLMENT_RECONCILIATION_BATCH_SIZE,
			staleBefore: STALE,
		});
		expect(recoverPurchase).toHaveBeenNthCalledWith(1, {
			domainId: registering.domainId,
			orderId: registering.orderId,
		});
		expect(recoverPurchase).toHaveBeenNthCalledWith(2, {
			domainId: configuring.domainId,
			orderId: configuring.orderId,
		});
		expect(recoverPurchase).toHaveBeenNthCalledWith(3, {
			domainId: activeNeedsHealing.domainId,
			orderId: activeNeedsHealing.orderId,
		});
	});

	it("defensively skips fresh, terminal, and already-healed DB-shaped rows", async () => {
		const { recoverPurchase, service } = setup([
			candidate({ updatedAt: new Date(STALE.getTime() + 1) }),
			candidate({ domainStatus: "failed" }),
			candidate({ domainStatus: "active", orderStatus: "fulfilled" }),
			candidate({ domainStatus: "registering", orderStatus: "refunded" }),
		]);

		await expect(service.execute()).resolves.toEqual({
			ensured: 0,
			processed: true,
			scanned: 4,
			skipped: 4,
		});
		expect(recoverPurchase).not.toHaveBeenCalled();
	});

	it("lets recovery failures escape for task-level retry", async () => {
		const { recoverPurchase, service } = setup([candidate()]);
		const error = new Error("Trigger API unavailable");
		recoverPurchase.mockRejectedValue(error);

		await expect(service.execute()).rejects.toBe(error);
	});
});
