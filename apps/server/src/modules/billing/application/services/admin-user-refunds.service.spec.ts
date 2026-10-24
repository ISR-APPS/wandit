import {
	BadGatewayException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { CreateRefundParams } from "../../domain/ports/payment-provider.port";
import type { InvoiceApplicationRow } from "../../infrastructure/persistence/subscription-credits.repository";
import type { SubscriptionRow } from "../../infrastructure/persistence/subscriptions.repository";
import {
	type AdminRefundStripeClient,
	AdminUserRefundsService,
} from "./admin-user-refunds.service";

const USER_ID = "user_1";
const INVOICE_ID = "in_1";

function subscriptionRow(overrides: Partial<SubscriptionRow>): SubscriptionRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
		currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
		id: "sub-row-1",
		interval: "month",
		organizationId: null,
		pendingAppliedBy: null,
		pendingInterval: null,
		pendingPlan: null,
		pendingTierCredits: null,
		plan: "pro",
		priceLookupKey: "pro_250_month",
		provider: "stripe",
		providerSubscriptionId: "sub_stripe_1",
		renewalReminderPeriodEnd: null,
		status: "active",
		tierCredits: 250,
		updatedAt: new Date("2026-10-01T00:00:00.000Z"),
		userId: USER_ID,
		...overrides,
	};
}

const invoiceRow: InvoiceApplicationRow = {
	amountPaidMinor: 2_000,
	appliedAt: new Date("2026-10-01T00:00:05.000Z"),
	billingReason: "subscription_cycle",
	creditsDelta: 25_000,
	currency: "usd",
	newPriceLookupKey: "pro_250_month",
	oldPriceLookupKey: null,
	paidAt: new Date("2026-10-01T00:00:00.000Z"),
	periodEnd: new Date("2026-11-01T00:00:00.000Z"),
	periodStart: new Date("2026-10-01T00:00:00.000Z"),
	stripeInvoiceId: INVOICE_ID,
	subscriptionId: "sub-row-1",
};

function setup(options: {
	subscription: SubscriptionRow;
	paymentIntentIds: string[];
	amountRefundedMinor: number;
	/** A live personal manual (SlickPay or offline) subscription of the user. */
	offlineSubscription?: SubscriptionRow;
}) {
	const stripe = {
		cancelSubscriptionNow: vi.fn(
			async (_providerSubscriptionId: string, _idempotencyKey: string) =>
				undefined,
		),
		createRefund: vi.fn(async (_params: CreateRefundParams) => ({
			amount: 2_000 - options.amountRefundedMinor,
			currency: "usd",
			id: "re_1",
			status: "pending",
		})),
		listInvoicePayments: vi.fn(async () =>
			options.paymentIntentIds.map((paymentIntentId) => ({
				payment: {
					payment_intent: paymentIntentId,
					type: "payment_intent" as const,
				},
			})),
		),
		retrievePaymentIntent: vi.fn(async () => ({
			latest_charge: {
				amount_captured: 2_000,
				amount_refunded: options.amountRefundedMinor,
				currency: "usd",
			},
		})),
		retrieveSubscription: vi.fn(async () => ({ status: "active" as const })),
	} satisfies AdminRefundStripeClient;
	const service = new AdminUserRefundsService(
		{
			findInvoiceApplication: vi.fn(async () => invoiceRow),
			findLatestPaidPersonalStripeInvoice: vi.fn(async () => ({
				invoice: invoiceRow,
				subscription: options.subscription,
			})),
		},
		{
			findActiveByOwnerAndProvider: vi.fn(
				async () => options.offlineSubscription ?? null,
			),
			findById: vi.fn(async () => options.subscription),
		},
		stripe,
	);

	return { service, stripe };
}

describe("AdminUserRefundsService.preview", () => {
	it("offers no Stripe payment to a user on a live SlickPay or offline plan", async () => {
		const { service, stripe } = setup({
			amountRefundedMinor: 0,
			offlineSubscription: subscriptionRow({ provider: "manual" }),
			paymentIntentIds: ["pi_1"],
			subscription: subscriptionRow({ status: "canceled" }),
		});

		await expect(service.preview(USER_ID)).resolves.toEqual({
			paidOffline: true,
			payment: null,
		});
		expect(stripe.listInvoicePayments).not.toHaveBeenCalled();
	});
});

describe("AdminUserRefundsService.refund", () => {
	it.each([
		["another user", { userId: "user_2" }],
		["a team", { organizationId: "org_1" }],
		["an offline plan", { provider: "manual" }],
	])("refuses an invoice of %s with 404 and no Stripe call", async (_label, overrides) => {
		const { service, stripe } = setup({
			amountRefundedMinor: 0,
			paymentIntentIds: ["pi_1"],
			subscription: subscriptionRow(overrides),
		});

		await expect(
			service.refund("admin_1", USER_ID, { stripeInvoiceId: INVOICE_ID }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(stripe.listInvoicePayments).not.toHaveBeenCalled();
		expect(stripe.createRefund).not.toHaveBeenCalled();
		expect(stripe.cancelSubscriptionNow).not.toHaveBeenCalled();
	});

	it("skips the refund of a fully refunded charge and still cancels the subscription", async () => {
		const { service, stripe } = setup({
			amountRefundedMinor: 2_000,
			paymentIntentIds: ["pi_1"],
			subscription: subscriptionRow({}),
		});

		await expect(
			service.refund("admin_1", USER_ID, { stripeInvoiceId: INVOICE_ID }),
		).resolves.toEqual({ refund: null, subscriptionCanceled: true });
		expect(stripe.createRefund).not.toHaveBeenCalled();
		expect(stripe.cancelSubscriptionNow).toHaveBeenCalledOnce();
	});

	it("tells the admin that the money moved when the cancel fails after the refund", async () => {
		const { service, stripe } = setup({
			amountRefundedMinor: 0,
			paymentIntentIds: ["pi_1"],
			subscription: subscriptionRow({}),
		});
		stripe.cancelSubscriptionNow.mockRejectedValueOnce(
			new Error("Stripe API error"),
		);

		const refund = service.refund("admin_1", USER_ID, {
			stripeInvoiceId: INVOICE_ID,
		});

		await expect(refund).rejects.toBeInstanceOf(BadGatewayException);
		await expect(refund).rejects.toMatchObject({
			response: { code: "ADMIN_REFUND_CANCEL_FAILED" },
		});
		expect(stripe.createRefund).toHaveBeenCalledOnce();
	});

	it("refuses an invoice with two paid payment sources with 409 and no Stripe write", async () => {
		const { service, stripe } = setup({
			amountRefundedMinor: 0,
			paymentIntentIds: ["pi_1", "pi_2"],
			subscription: subscriptionRow({}),
		});

		await expect(
			service.refund("admin_1", USER_ID, { stripeInvoiceId: INVOICE_ID }),
		).rejects.toBeInstanceOf(ConflictException);
		expect(stripe.createRefund).not.toHaveBeenCalled();
		expect(stripe.cancelSubscriptionNow).not.toHaveBeenCalled();
	});

	it("sends the same Stripe idempotency keys on a repeated click", async () => {
		const { service, stripe } = setup({
			amountRefundedMinor: 500,
			paymentIntentIds: ["pi_1"],
			subscription: subscriptionRow({}),
		});

		await service.refund("admin_1", USER_ID, { stripeInvoiceId: INVOICE_ID });
		await service.refund("admin_2", USER_ID, { stripeInvoiceId: INVOICE_ID });

		const [firstRefund, secondRefund] = stripe.createRefund.mock.calls;
		const [firstCancel, secondCancel] = stripe.cancelSubscriptionNow.mock.calls;
		expect(stripe.createRefund).toHaveBeenCalledTimes(2);
		expect(firstRefund).toEqual(secondRefund);
		expect(stripe.cancelSubscriptionNow).toHaveBeenCalledTimes(2);
		expect(firstCancel).toEqual(secondCancel);
	});
});
