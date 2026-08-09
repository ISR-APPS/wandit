import { describe, expect, it, vi } from "vitest";

import type { PaymentOrderRow } from "../../domain/payment-order.types";
import {
	OrderRefundInvariantViolationError,
	OrderRefundStep,
} from "./order-refund.step";

const orderId = "11111111-1111-4111-8111-111111111111";
const paymentIntentId = "pi_order_refund";

function order(
	status: PaymentOrderRow["status"],
	overrides: Partial<PaymentOrderRow> = {},
): PaymentOrderRow {
	const now = new Date("2026-07-24T12:00:00.000Z");

	return {
		amountCents: 1_500,
		createdAt: now,
		currency: "usd",
		fulfilledAt: null,
		fulfillmentError: null,
		id: orderId,
		kind: "domain_registration",
		metadata: {},
		paidAt: now,
		provider: "stripe",
		providerCheckoutSessionId: "cs_order_refund",
		providerPaymentIntentId: paymentIntentId,
		providerPaymentStatus: "paid",
		providerRefundId: null,
		refundStatus: null,
		status,
		updatedAt: now,
		userId: "user_1",
		...overrides,
	};
}

function stripeRefund(status: string | null) {
	return {
		id: `re_${status ?? "unknown"}`,
		status,
	};
}

function setup(initialStatus: PaymentOrderRow["status"]) {
	let row = order(initialStatus);
	const events: string[] = [];
	const orderStore = {
		findById: vi.fn(async (): Promise<PaymentOrderRow | null> => row),
		markFailed: vi.fn(async (_id: string, failureReason: string) => {
			events.push(`failed:${failureReason}`);

			if (row.status !== "paid" && row.status !== "fulfilling") {
				return null;
			}

			row = {
				...row,
				fulfillmentError: failureReason,
				status: "failed",
			};

			return row;
		}),
	};
	const paymentProvider = {
		createRefund: vi.fn(async (): Promise<unknown> => {
			events.push("stripe");

			return stripeRefund("succeeded");
		}),
	};
	const refundStateUpdater = {
		updateRefundStatus: vi.fn(
			async (input: {
				paymentIntentId: string | null;
				providerRefundId: string;
				refundStatus: string | null;
			}) => {
				events.push(`persist:${input.refundStatus ?? "unknown"}`);
				row = {
					...row,
					fulfillmentError:
						input.refundStatus === "failed" || input.refundStatus === "canceled"
							? "Manual review required"
							: row.fulfillmentError,
					providerRefundId: input.providerRefundId,
					refundStatus: input.refundStatus,
					status: input.refundStatus === "succeeded" ? "refunded" : row.status,
				};

				return true;
			},
		),
	};
	const step = new OrderRefundStep(
		orderStore,
		paymentProvider,
		refundStateUpdater,
	);

	return {
		events,
		get row() {
			return row;
		},
		orderStore,
		paymentProvider,
		refundStateUpdater,
		setRow(next: PaymentOrderRow) {
			row = next;
		},
		step,
	};
}

describe("OrderRefundStep", () => {
	it.each([
		"paid",
		"fulfilling",
	] as const)("marks a %s order failed before creating and recording its refund", async (status) => {
		const fixture = setup(status);

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).resolves.toBe(true);

		expect(fixture.events).toEqual([
			"failed:Domain registration failed",
			"stripe",
			"persist:succeeded",
		]);
		expect(fixture.paymentProvider.createRefund).toHaveBeenCalledWith({
			idempotencyKey: `order-refund:${orderId}`,
			paymentIntentId,
		});
		expect(fixture.refundStateUpdater.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId,
			providerRefundId: "re_succeeded",
			refundStatus: "succeeded",
		});
		expect(fixture.row.status).toBe("refunded");
	});

	it("refunds an already-failed eligible order without rewriting its failure", async () => {
		const fixture = setup("failed");

		await expect(
			fixture.step.execute(orderId, "replacement reason"),
		).resolves.toBe(true);

		expect(fixture.orderStore.markFailed).not.toHaveBeenCalled();
		expect(fixture.paymentProvider.createRefund).toHaveBeenCalledTimes(1);
	});

	it.each([
		"pending",
		"requires_action",
	] as const)("records a %s refund without claiming the order is refunded", async (status) => {
		const fixture = setup("failed");
		fixture.paymentProvider.createRefund.mockResolvedValueOnce(
			stripeRefund(status),
		);

		await fixture.step.execute(orderId, "Domain registration failed");

		expect(fixture.row).toMatchObject({
			providerRefundId: `re_${status}`,
			refundStatus: status,
			status: "failed",
		});
	});

	it.each([
		"failed",
		"canceled",
	] as const)("leaves a %s refund in failed manual-review state", async (status) => {
		const fixture = setup("failed");
		fixture.paymentProvider.createRefund.mockResolvedValueOnce(
			stripeRefund(status),
		);

		await fixture.step.execute(orderId, "Domain registration failed");

		expect(fixture.row).toMatchObject({
			fulfillmentError: "Manual review required",
			providerRefundId: `re_${status}`,
			refundStatus: status,
			status: "failed",
		});
	});

	it("records Stripe's null refund status without treating it as malformed", async () => {
		const fixture = setup("failed");
		fixture.paymentProvider.createRefund.mockResolvedValueOnce(
			stripeRefund(null),
		);

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).resolves.toBe(true);
		expect(fixture.refundStateUpdater.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId,
			providerRefundId: "re_unknown",
			refundStatus: null,
		});
	});

	it("propagates Stripe creation failures after leaving the order retryable as failed", async () => {
		const fixture = setup("fulfilling");
		fixture.paymentProvider.createRefund.mockRejectedValueOnce(
			new Error("Stripe unavailable"),
		);

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).rejects.toThrow("Stripe unavailable");
		expect(fixture.row.status).toBe("failed");
		expect(
			fixture.refundStateUpdater.updateRefundStatus,
		).not.toHaveBeenCalled();
	});

	it.each([
		"pending",
		"fulfilled",
		"canceled",
		"refunded",
	] as const)("does not refund an order that is already %s", async (status) => {
		const fixture = setup(status);

		await expect(fixture.step.execute(orderId, "stale failure")).resolves.toBe(
			false,
		);
		expect(fixture.orderStore.markFailed).not.toHaveBeenCalled();
		expect(fixture.paymentProvider.createRefund).not.toHaveBeenCalled();
	});

	it("rejects a missing payment order", async () => {
		const fixture = setup("failed");
		fixture.orderStore.findById.mockResolvedValueOnce(null);

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).rejects.toEqual(
			expect.objectContaining({
				code: "ORDER_INVARIANT_VIOLATION",
				message: `Payment order ${orderId} not found for refund`,
				name: "OrderRefundInvariantViolationError",
			}),
		);
		expect(fixture.paymentProvider.createRefund).not.toHaveBeenCalled();
	});

	it.each([
		null,
		"",
	])("rejects an eligible failed order whose payment intent is %j", async (providerPaymentIntentId) => {
		const fixture = setup("failed");
		fixture.setRow(order("failed", { providerPaymentIntentId }));

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).rejects.toThrow(`Failed payment order ${orderId} has no payment intent`);
		expect(fixture.paymentProvider.createRefund).not.toHaveBeenCalled();
	});

	it.each([
		["null", null],
		["missing fields", {}],
		["non-string id", { id: 123, status: "succeeded" }],
		["undefined status", { id: "re_invalid", status: undefined }],
		["non-string status", { id: "re_invalid", status: 123 }],
	] as const)("rejects a %s Stripe refund result", async (_label, refund) => {
		const fixture = setup("failed");
		fixture.paymentProvider.createRefund.mockResolvedValueOnce(refund);

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).rejects.toThrow(
			`Stripe returned an invalid refund for payment order ${orderId}`,
		);
		expect(
			fixture.refundStateUpdater.updateRefundStatus,
		).not.toHaveBeenCalled();
	});

	it("throws when the returned Stripe refund cannot reconcile to the order", async () => {
		const fixture = setup("failed");
		fixture.refundStateUpdater.updateRefundStatus.mockResolvedValueOnce(false);

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).rejects.toThrow(
			`Stripe refund re_succeeded could not reconcile payment order ${orderId}`,
		);
	});

	it("continues after a failed mark CAS when a reload observes the order as failed", async () => {
		const fixture = setup("paid");
		fixture.orderStore.markFailed.mockResolvedValueOnce(null);
		fixture.orderStore.findById
			.mockResolvedValueOnce(order("paid"))
			.mockResolvedValueOnce(order("failed"));

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).resolves.toBe(true);
		expect(fixture.paymentProvider.createRefund).toHaveBeenCalledTimes(1);
	});

	it.each([
		null,
		order("refunded"),
	])("stops after a failed mark CAS when the reload is no longer eligible", async (current) => {
		const fixture = setup("paid");
		fixture.orderStore.markFailed.mockResolvedValueOnce(null);
		fixture.orderStore.findById
			.mockResolvedValueOnce(order("paid"))
			.mockResolvedValueOnce(current);

		await expect(
			fixture.step.execute(orderId, "Domain registration failed"),
		).resolves.toBe(false);
		expect(fixture.paymentProvider.createRefund).not.toHaveBeenCalled();
	});

	it("uses the dedicated framework-light invariant error", () => {
		const error = new OrderRefundInvariantViolationError("bad refund state");

		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({
			code: "ORDER_INVARIANT_VIOLATION",
			message: "bad refund state",
			name: "OrderRefundInvariantViolationError",
		});
	});
});
