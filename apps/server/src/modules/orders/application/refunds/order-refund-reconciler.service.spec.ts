import { beforeEach, describe, expect, it, vi } from "vitest";
import { DOMAIN_FULFILLMENT_RECONCILIATION_STALE_MS } from "../../../domains/application/fulfillment/domain-fulfillment-reconciler.service";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import {
	ORDER_REFUND_RECONCILIATION_BATCH_SIZE,
	type OrderRefundReconcilerDependencies,
	OrderRefundReconcilerService,
} from "./order-refund-reconciler.service";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-01T12:00:00.000Z");
const STALE_BEFORE = new Date(
	NOW.getTime() - DOMAIN_FULFILLMENT_RECONCILIATION_STALE_MS,
);
const TRANSACTION = { kind: "transaction" };

function eligibleOrder(
	overrides: Partial<PaymentOrderRow> = {},
): PaymentOrderRow {
	return {
		amountCents: 2_000,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		currency: "usd",
		fulfilledAt: null,
		fulfillmentError: "Registrar rejected the request",
		id: ORDER_ID,
		kind: "domain_registration",
		metadata: {},
		paidAt: new Date("2026-01-01T00:01:00.000Z"),
		provider: "stripe",
		providerCheckoutSessionId: "cs_1",
		providerPaymentIntentId: "pi_1",
		providerPaymentStatus: "succeeded",
		providerRefundId: null,
		refundStatus: null,
		status: "failed",
		updatedAt: new Date("2026-01-01T00:02:00.000Z"),
		userId: "user_1",
		...overrides,
	};
}

function strandedPaidOrder(
	overrides: Partial<PaymentOrderRow> = {},
): PaymentOrderRow {
	return eligibleOrder({
		fulfillmentError: null,
		status: "paid",
		updatedAt: STALE_BEFORE,
		...overrides,
	});
}

function setup() {
	let fencedOrder: PaymentOrderRow | null = null;
	const dependencies = {
		findDomainForUpdate: vi.fn().mockResolvedValue(null),
		findOrder: vi.fn(),
		findRefundReconciliationCandidates: vi.fn(),
		recoverRefund: vi.fn().mockResolvedValue({ id: "run_refund" }),
		markOrderFailed: vi.fn(async () =>
			fencedOrder
				? {
						...fencedOrder,
						fulfillmentError: "Domain registration failed",
						status: "failed" as const,
					}
				: null,
		),
		now: vi.fn(() => NOW),
		withOrderFulfillmentFence: vi.fn(
			async <T>(
				_orderId: string,
				operation: (order: PaymentOrderRow, transaction: unknown) => Promise<T>,
			): Promise<T> => {
				if (!fencedOrder) {
					throw new Error("Missing fenced order fixture");
				}

				return operation(fencedOrder, TRANSACTION);
			},
		),
	};
	const service = new OrderRefundReconcilerService(
		dependencies as OrderRefundReconcilerDependencies,
	);

	return {
		dependencies,
		service,
		setFencedOrder(order: PaymentOrderRow) {
			fencedOrder = order;
		},
	};
}

describe("OrderRefundReconcilerService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("runs a bounded scan and does nothing when no order is eligible", async () => {
		const { dependencies, service } = setup();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([]);

		await expect(service.execute()).resolves.toEqual({
			recovered: 0,
			scanned: 0,
		});
		expect(
			dependencies.findRefundReconciliationCandidates,
		).toHaveBeenCalledWith({
			limit: ORDER_REFUND_RECONCILIATION_BATCH_SIZE,
			staleBefore: STALE_BEFORE,
		});
		expect(dependencies.findOrder).not.toHaveBeenCalled();
		expect(dependencies.recoverRefund).not.toHaveBeenCalled();
	});

	it("rechecks each candidate and recovers it with the persisted reason", async () => {
		const { dependencies, service } = setup();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
		]);
		dependencies.findOrder.mockResolvedValue(eligibleOrder());

		await expect(service.execute()).resolves.toEqual({
			recovered: 1,
			scanned: 1,
		});
		expect(dependencies.findOrder).toHaveBeenCalledWith(ORDER_ID);
		expect(dependencies.recoverRefund).toHaveBeenCalledWith({
			failureReason: "Registrar rejected the request",
			orderId: ORDER_ID,
		});
	});

	it("uses a strict bounded fallback reason for an empty or oversized error", async () => {
		const { dependencies, service } = setup();
		const secondOrderId = "22222222-2222-4222-8222-222222222222";
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
			{ id: secondOrderId },
		]);
		dependencies.findOrder
			.mockResolvedValueOnce(eligibleOrder({ fulfillmentError: "   " }))
			.mockResolvedValueOnce(
				eligibleOrder({
					fulfillmentError: "x".repeat(2_001),
					id: secondOrderId,
				}),
			);

		await service.execute();

		expect(dependencies.recoverRefund).toHaveBeenNthCalledWith(1, {
			failureReason: "Domain registration failed",
			orderId: ORDER_ID,
		});
		expect(dependencies.recoverRefund).toHaveBeenNthCalledWith(2, {
			failureReason: "x".repeat(2_000),
			orderId: secondOrderId,
		});
	});

	it.each([
		["missing", null],
		["fulfilled", eligibleOrder({ status: "fulfilled" })],
		["not paid", eligibleOrder({ paidAt: null })],
		["no payment intent", eligibleOrder({ providerPaymentIntentId: null })],
		["already has refund", eligibleOrder({ providerRefundId: "re_1" })],
	])("skips a candidate that became %s during the recheck", async (_label, row) => {
		const { dependencies, service } = setup();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
		]);
		dependencies.findOrder.mockResolvedValue(row);

		await expect(service.execute()).resolves.toEqual({
			recovered: 0,
			scanned: 1,
		});
		expect(dependencies.recoverRefund).not.toHaveBeenCalled();
	});

	it.each([
		"a DomainAlreadyExistsError whose first refund dispatch failed",
		"an OrderInvariantViolationError rethrow before domain creation",
	])("recovers a stale paid/no-domain order left by %s", async () => {
		const { dependencies, service, setFencedOrder } = setup();
		const order = strandedPaidOrder();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
		]);
		dependencies.findOrder.mockResolvedValue(order);
		setFencedOrder(order);

		await expect(service.execute()).resolves.toEqual({
			recovered: 1,
			scanned: 1,
		});
		expect(dependencies.withOrderFulfillmentFence).toHaveBeenCalledWith(
			ORDER_ID,
			expect.any(Function),
		);
		expect(dependencies.findDomainForUpdate).toHaveBeenCalledWith(
			ORDER_ID,
			TRANSACTION,
		);
		expect(dependencies.recoverRefund).toHaveBeenCalledWith({
			failureReason: "Domain registration failed",
			orderId: ORDER_ID,
		});
		expect(dependencies.markOrderFailed).toHaveBeenCalledWith(
			ORDER_ID,
			"Domain registration failed",
			TRANSACTION,
		);
		expect(dependencies.recoverRefund.mock.invocationCallOrder[0]).toBeLessThan(
			dependencies.markOrderFailed.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it("leaves a stale paid order retryable when recovery dispatch fails", async () => {
		const { dependencies, service, setFencedOrder } = setup();
		const order = strandedPaidOrder();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
		]);
		dependencies.findOrder.mockResolvedValue(order);
		dependencies.recoverRefund.mockRejectedValue(
			new Error("Trigger unavailable"),
		);
		setFencedOrder(order);

		await expect(service.execute()).rejects.toThrow("Trigger unavailable");
		expect(dependencies.markOrderFailed).not.toHaveBeenCalled();
	});

	it("does not refund an order that entered fulfillment before the fence", async () => {
		const { dependencies, service, setFencedOrder } = setup();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
		]);
		dependencies.findOrder.mockResolvedValue(strandedPaidOrder());
		setFencedOrder(strandedPaidOrder({ status: "fulfilling" }));

		await expect(service.execute()).resolves.toEqual({
			recovered: 0,
			scanned: 1,
		});
		expect(dependencies.findDomainForUpdate).not.toHaveBeenCalled();
		expect(dependencies.recoverRefund).not.toHaveBeenCalled();
		expect(dependencies.markOrderFailed).not.toHaveBeenCalled();
	});

	it("does not refund a purchase with a linked domain and therefore a possible live run", async () => {
		const { dependencies, service, setFencedOrder } = setup();
		const order = strandedPaidOrder();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
		]);
		dependencies.findOrder.mockResolvedValue(order);
		dependencies.findDomainForUpdate.mockResolvedValue({
			id: "22222222-2222-4222-8222-222222222222",
		});
		setFencedOrder(order);

		await expect(service.execute()).resolves.toEqual({
			recovered: 0,
			scanned: 1,
		});
		expect(dependencies.recoverRefund).not.toHaveBeenCalled();
		expect(dependencies.markOrderFailed).not.toHaveBeenCalled();
	});

	it("defensively skips a paid/no-domain candidate newer than the shared stale threshold", async () => {
		const { dependencies, service } = setup();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
		]);
		dependencies.findOrder.mockResolvedValue(
			strandedPaidOrder({
				updatedAt: new Date(STALE_BEFORE.getTime() + 1),
			}),
		);

		await expect(service.execute()).resolves.toEqual({
			recovered: 0,
			scanned: 1,
		});
		expect(dependencies.withOrderFulfillmentFence).not.toHaveBeenCalled();
		expect(dependencies.recoverRefund).not.toHaveBeenCalled();
	});

	it("caps an oversized requested batch and propagates a recovery failure", async () => {
		const { dependencies, service } = setup();
		dependencies.findRefundReconciliationCandidates.mockResolvedValue([
			{ id: ORDER_ID },
		]);
		dependencies.findOrder.mockResolvedValue(eligibleOrder());
		dependencies.recoverRefund.mockRejectedValue(
			new Error("Trigger unavailable"),
		);

		await expect(service.execute(Number.MAX_SAFE_INTEGER)).rejects.toThrow(
			"Trigger unavailable",
		);
		expect(
			dependencies.findRefundReconciliationCandidates,
		).toHaveBeenCalledWith({
			limit: ORDER_REFUND_RECONCILIATION_BATCH_SIZE,
			staleBefore: STALE_BEFORE,
		});
	});
});
