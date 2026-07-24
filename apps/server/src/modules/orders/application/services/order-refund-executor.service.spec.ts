import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { PaymentProvider } from "../../../billing/domain/ports/payment-provider.port";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import type { PaymentOrdersRepository } from "../../infrastructure/persistence/payment-orders.repository";
import { OrderRefundExecutorService } from "./order-refund-executor.service";
import type { OrderRefundsService } from "./order-refunds.service";

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

function stripeRefund(status: Stripe.Refund["status"]): Stripe.Refund {
	return {
		id: `re_${status ?? "unknown"}`,
		status,
	} as Stripe.Refund;
}

function setup(initialStatus: PaymentOrderRow["status"]) {
	let row = order(initialStatus);
	const events: string[] = [];
	const repository = {
		findById: vi.fn(async () => row),
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
	const provider = {
		createRefund: vi.fn(async () => {
			events.push("stripe");

			return stripeRefund("succeeded");
		}),
	};
	const refunds = {
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
	const service = new OrderRefundExecutorService(
		repository as unknown as PaymentOrdersRepository,
		provider as unknown as PaymentProvider,
		refunds as unknown as OrderRefundsService,
	);

	return {
		events,
		get row() {
			return row;
		},
		provider,
		refunds,
		repository,
		service,
	};
}

describe("OrderRefundExecutorService", () => {
	it.each([
		"paid",
		"fulfilling",
	] as const)("marks a %s order failed before creating and recording its refund", async (status) => {
		const fixture = setup(status);

		await expect(
			fixture.service.execute(orderId, "Domain registration failed"),
		).resolves.toBe(true);

		expect(fixture.events).toEqual([
			"failed:Domain registration failed",
			"stripe",
			"persist:succeeded",
		]);
		expect(fixture.provider.createRefund).toHaveBeenCalledWith({
			idempotencyKey: `order-refund:${orderId}`,
			paymentIntentId,
		});
		expect(fixture.refunds.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId,
			providerRefundId: "re_succeeded",
			refundStatus: "succeeded",
		});
		expect(fixture.row.status).toBe("refunded");
	});

	it.each([
		"pending",
		"requires_action",
	] as const)("records a %s refund without claiming the order is refunded", async (status) => {
		const fixture = setup("failed");
		fixture.provider.createRefund.mockResolvedValueOnce(stripeRefund(status));

		await fixture.service.execute(orderId, "Domain registration failed");

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
		fixture.provider.createRefund.mockResolvedValueOnce(stripeRefund(status));

		await fixture.service.execute(orderId, "Domain registration failed");

		expect(fixture.row).toMatchObject({
			fulfillmentError: "Manual review required",
			refundStatus: status,
			status: "failed",
		});
	});

	it("throws Stripe creation failures so BullMQ retries the durable job", async () => {
		const fixture = setup("fulfilling");
		fixture.provider.createRefund.mockRejectedValueOnce(
			new Error("Stripe unavailable"),
		);

		await expect(
			fixture.service.execute(orderId, "Domain registration failed"),
		).rejects.toThrow("Stripe unavailable");
		expect(fixture.row.status).toBe("failed");
		expect(fixture.refunds.updateRefundStatus).not.toHaveBeenCalled();
	});

	it.each([
		"pending",
		"fulfilled",
		"canceled",
		"refunded",
	] as const)("does not refund an order that is already %s", async (status) => {
		const fixture = setup(status);

		await expect(
			fixture.service.execute(orderId, "stale failure"),
		).resolves.toBe(false);
		expect(fixture.provider.createRefund).not.toHaveBeenCalled();
	});
});
