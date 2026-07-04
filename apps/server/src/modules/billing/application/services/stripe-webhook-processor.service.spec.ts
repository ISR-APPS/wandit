import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import type { BillingCreditLedgerRepository } from "../../infrastructure/persistence/billing-credit-ledger.repository";
import type { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import type { BillingWebhookEventsRepository } from "../../infrastructure/persistence/billing-webhook-events.repository";
import type {
	SubscriptionRow,
	SubscriptionsRepository,
	UpsertSubscriptionInput,
} from "../../infrastructure/persistence/subscriptions.repository";
import type { StripeProvider } from "../../infrastructure/stripe/stripe.provider";
import { StripeWebhookProcessor } from "./stripe-webhook-processor.service";

type WebhookStatus = "failed" | "processed" | "received" | "skipped";

class FakeWebhookEventsRepository {
	private readonly events = new Map<
		string,
		{ error: string | null; status: WebhookStatus; type: string }
	>();

	readonly markProcessed = vi.fn(async (id: string) => {
		this.mark(id, "processed", null);
	});

	readonly markSkipped = vi.fn(async (id: string) => {
		this.mark(id, "skipped", null);
	});

	readonly markFailed = vi.fn(async (id: string, error: string) => {
		this.mark(id, "failed", error);
	});

	async tryInsertReceived(event: Stripe.Event) {
		if (this.events.has(event.id)) {
			return false;
		}

		this.events.set(event.id, {
			error: null,
			status: "received",
			type: event.type,
		});

		return true;
	}

	async findById(id: string) {
		const event = this.events.get(id);

		if (!event) {
			return null;
		}

		return {
			createdAt: new Date(0),
			error: event.error,
			id,
			payload: {},
			processedAt: null,
			provider: "stripe",
			status: event.status,
			type: event.type,
		};
	}

	seed(id: string, status: WebhookStatus, type = "invoice.paid") {
		this.events.set(id, {
			error: null,
			status,
			type,
		});
	}

	statusOf(id: string) {
		return this.events.get(id)?.status;
	}

	errorOf(id: string) {
		return this.events.get(id)?.error;
	}

	private mark(id: string, status: WebhookStatus, error: string | null) {
		const existing = this.events.get(id);

		this.events.set(id, {
			error,
			status,
			type: existing?.type ?? "unknown",
		});
	}
}

class FakeBillingCustomersRepository {
	private readonly byProviderCustomerId = new Map<
		string,
		{ provider: string; providerCustomerId: string; userId: string }
	>();

	async upsertByUserId(input: {
		provider: string;
		providerCustomerId: string;
		userId: string;
	}) {
		this.byProviderCustomerId.set(input.providerCustomerId, input);

		return {
			...input,
			createdAt: new Date(0),
			id: `bc_${input.userId}`,
			updatedAt: new Date(0),
		};
	}

	async findByProviderCustomerId(providerCustomerId: string) {
		const customer = this.byProviderCustomerId.get(providerCustomerId);

		if (!customer) {
			return null;
		}

		return {
			...customer,
			createdAt: new Date(0),
			id: `bc_${customer.userId}`,
			updatedAt: new Date(0),
		};
	}
}

class FakeSubscriptionsRepository {
	private readonly rows = new Map<string, SubscriptionRow>();

	async upsertByProviderSubscriptionId(input: UpsertSubscriptionInput) {
		const row = {
			...input,
			cancelAtPeriodEnd: input.cancelAtPeriodEnd,
			createdAt: new Date(0),
			id: `subrow_${input.providerSubscriptionId}`,
			organizationId: input.organizationId ?? null,
			updatedAt: new Date(0),
		} satisfies SubscriptionRow;

		this.rows.set(input.providerSubscriptionId, row);

		return row;
	}

	async findByProviderSubscriptionId(providerSubscriptionId: string) {
		return this.rows.get(providerSubscriptionId) ?? null;
	}

	async updateStatus(providerSubscriptionId: string, status: string) {
		const row = this.rows.get(providerSubscriptionId);

		if (!row) {
			return null;
		}

		const updated = {
			...row,
			status,
			updatedAt: new Date(0),
		} satisfies SubscriptionRow;
		this.rows.set(providerSubscriptionId, updated);

		return updated;
	}

	seed(input: {
		priceLookupKey: string;
		providerSubscriptionId: string;
		userId: string;
	}) {
		const [plan, tierCreditsValue, interval] = input.priceLookupKey.split("_");
		const row = {
			cancelAtPeriodEnd: false,
			createdAt: new Date(0),
			currentPeriodEnd: new Date(2_000_000),
			currentPeriodStart: new Date(1_000_000),
			id: `subrow_${input.providerSubscriptionId}`,
			interval,
			organizationId: null,
			plan,
			priceLookupKey: input.priceLookupKey,
			provider: "stripe",
			providerSubscriptionId: input.providerSubscriptionId,
			status: "active",
			tierCredits: Number(tierCreditsValue),
			updatedAt: new Date(0),
			userId: input.userId,
		} as SubscriptionRow;

		this.rows.set(input.providerSubscriptionId, row);

		return row;
	}
}

class FakeBillingCreditLedgerRepository {
	private readonly rowsByPaymentIntentId = new Map<
		string,
		Array<{ delta: number; userId: string }>
	>();

	readonly findPositiveRowsByPaymentIntentId = vi.fn(
		async (paymentIntentId: string) =>
			(this.rowsByPaymentIntentId.get(paymentIntentId) ?? []).map(
				(row, index) =>
					({
						bucket: "topup",
						createdAt: new Date(index * 1000),
						delta: row.delta,
						id: `ledger_${paymentIntentId}_${index}`,
						idempotencyKey: null,
						kind: "topup",
						meta: { paymentIntentId },
						organizationId: null,
						userId: row.userId,
					}) as const,
			),
	);

	seed(
		paymentIntentId: string,
		rows: Array<{ delta: number; userId: string }>,
	) {
		this.rowsByPaymentIntentId.set(paymentIntentId, rows);
	}
}

class FakeCreditsService {
	readonly expireAmount = vi.fn(async () => 0);
	readonly expirePlanRemainder = vi.fn(async () => 0);
	readonly grant = vi.fn(async () => undefined);
	readonly revoke = vi.fn(async () => undefined);
	readonly topup = vi.fn(async () => undefined);
}

class FakeStripeProvider {
	readonly invoices = new Map<string, Stripe.Invoice>();
	readonly subscriptions = new Map<string, Stripe.Subscription>();
	readonly lookupKeyByPriceId = new Map<string, string | null>();

	readonly retrieveInvoice = vi.fn(async (invoiceId: string) => {
		const invoice = this.invoices.get(invoiceId);

		if (!invoice) {
			throw new Error(`Missing test invoice ${invoiceId}`);
		}

		return invoice;
	});

	readonly retrieveSubscription = vi.fn(
		async (providerSubscriptionId: string) => {
			const subscription = this.subscriptions.get(providerSubscriptionId);

			if (!subscription) {
				throw new Error(`Missing test subscription ${providerSubscriptionId}`);
			}

			return subscription;
		},
	);

	readonly lookupKeyForPriceId = vi.fn(async (priceId: string) => {
		return this.lookupKeyByPriceId.get(priceId) ?? null;
	});
}

function setup() {
	const webhookEvents = new FakeWebhookEventsRepository();
	const billingCustomers = new FakeBillingCustomersRepository();
	const subscriptions = new FakeSubscriptionsRepository();
	const billingCreditLedger = new FakeBillingCreditLedgerRepository();
	const credits = new FakeCreditsService();
	const stripe = new FakeStripeProvider();
	const processor = new StripeWebhookProcessor(
		webhookEvents as unknown as BillingWebhookEventsRepository,
		billingCustomers as unknown as BillingCustomersRepository,
		subscriptions as unknown as SubscriptionsRepository,
		billingCreditLedger as unknown as BillingCreditLedgerRepository,
		credits as unknown as CreditsService,
		stripe as unknown as StripeProvider,
	);

	return {
		billingCreditLedger,
		billingCustomers,
		credits,
		processor,
		stripe,
		subscriptions,
		webhookEvents,
	};
}

function stripeEvent(
	type: string,
	object: Record<string, unknown>,
	id = `evt_${type.replaceAll(".", "_")}`,
) {
	return {
		api_version: "2026-02-25.clover",
		created: 0,
		data: { object },
		id,
		livemode: false,
		object: "event",
		pending_webhooks: 1,
		request: null,
		type,
	} as unknown as Stripe.Event;
}

function checkoutSession(input: {
	credits?: string;
	id: string;
	mode: "payment" | "subscription";
	packId?: string;
	paymentIntentId?: string;
	userId?: string;
}) {
	return {
		client_reference_id: input.userId ?? null,
		customer: "cus_1",
		id: input.id,
		metadata: {
			...(input.credits ? { credits: input.credits } : {}),
			...(input.packId ? { packId: input.packId } : {}),
			...(input.userId ? { userId: input.userId } : {}),
		},
		mode: input.mode,
		payment_intent: input.paymentIntentId ?? null,
	} as unknown as Stripe.Checkout.Session;
}

function stripeSubscription(input: {
	customer?: string;
	id: string;
	lookupKey: string;
	userId?: string;
}) {
	return {
		cancel_at_period_end: false,
		customer: input.customer ?? "cus_1",
		id: input.id,
		items: {
			data: [
				{
					current_period_end: 200,
					current_period_start: 100,
					id: `si_${input.id}`,
					price: {
						id: `price_${input.lookupKey}`,
						lookup_key: input.lookupKey,
					},
				},
			],
		},
		metadata: input.userId ? { userId: input.userId } : {},
		object: "subscription",
		status: "active",
	} as unknown as Stripe.Subscription;
}

function invoiceLine(input: {
	amount?: number;
	lookupKey: string;
	proration?: boolean;
}) {
	return {
		amount: input.amount ?? 0,
		parent: {
			subscription_item_details: {
				proration: input.proration ?? false,
			},
			type: "subscription_item_details",
		},
		pricing: {
			price_details: {
				price: {
					id: `price_${input.lookupKey}`,
					lookup_key: input.lookupKey,
				},
			},
		},
	} as unknown as Stripe.InvoiceLineItem;
}

function stripeInvoice(input: {
	billingReason:
		| "subscription_create"
		| "subscription_cycle"
		| "subscription_update";
	customer?: string;
	id: string;
	lines: Stripe.InvoiceLineItem[];
	paymentIntentId?: string;
	subscription?: string | Stripe.Subscription;
	userId?: string;
}) {
	return {
		billing_reason: input.billingReason,
		customer: input.customer ?? "cus_1",
		id: input.id,
		lines: {
			data: input.lines,
		},
		parent: {
			subscription_details: {
				metadata: input.userId ? { userId: input.userId } : {},
				subscription: input.subscription ?? "sub_1",
			},
		},
		payments: {
			data: input.paymentIntentId
				? [
						{
							payment: {
								payment_intent: input.paymentIntentId,
							},
						},
					]
				: [],
		},
	} as unknown as Stripe.Invoice;
}

function paidInvoiceEvent(invoiceId: string, eventId = `evt_${invoiceId}`) {
	return stripeEvent("invoice.paid", { id: invoiceId }, eventId);
}

describe("StripeWebhookProcessor", () => {
	it("does not invoke handlers for duplicate processed events", async () => {
		const { credits, processor, stripe, webhookEvents } = setup();
		webhookEvents.seed("evt_duplicate", "processed");

		await processor.process(paidInvoiceEvent("in_duplicate", "evt_duplicate"));

		expect(stripe.retrieveInvoice).not.toHaveBeenCalled();
		expect(credits.grant).not.toHaveBeenCalled();
	});

	it.each([
		"received",
		"failed",
	] as const)("reprocesses duplicate %s events", async (status) => {
		const { credits, processor, stripe, webhookEvents } = setup();
		const invoice = stripeInvoice({
			billingReason: "subscription_create",
			id: `in_${status}`,
			lines: [
				invoiceLine({
					lookupKey: "pro_100_month",
				}),
			],
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);
		webhookEvents.seed(`evt_${status}`, status);

		await processor.process(paidInvoiceEvent(invoice.id, `evt_${status}`));

		expect(stripe.retrieveInvoice).toHaveBeenCalledWith(invoice.id);
		expect(credits.grant).toHaveBeenCalledWith(
			"user_1",
			100,
			expect.objectContaining({
				idempotencyKey: `inv:${invoice.id}:grant`,
			}),
		);
		expect(webhookEvents.statusOf(`evt_${status}`)).toBe("processed");
	});

	it("handles checkout.session.completed payment mode as a top-up", async () => {
		const { credits, processor } = setup();

		await processor.process(
			stripeEvent(
				"checkout.session.completed",
				checkoutSession({
					credits: "500",
					id: "cs_1",
					mode: "payment",
					packId: "topup_500",
					paymentIntentId: "pi_1",
					userId: "user_1",
				}) as unknown as Record<string, unknown>,
				"evt_checkout",
			),
		);

		expect(credits.topup).toHaveBeenCalledWith("user_1", 500, {
			idempotencyKey: "topup:cs_1",
			meta: {
				packId: "topup_500",
				paymentIntentId: "pi_1",
				reason: "topup_purchase",
				sessionId: "cs_1",
			},
		});
	});

	it("grants a yearly subscription_create invoice allotment", async () => {
		const { credits, processor, stripe } = setup();
		const invoice = stripeInvoice({
			billingReason: "subscription_create",
			id: "in_create",
			lines: [
				invoiceLine({
					lookupKey: "pro_100_year",
				}),
			],
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);

		await processor.process(paidInvoiceEvent(invoice.id, "evt_create"));

		expect(credits.grant).toHaveBeenCalledWith("user_1", 1200, {
			bucket: "plan",
			idempotencyKey: "inv:in_create:grant",
			meta: {
				invoiceId: "in_create",
				reason: "subscription_initial",
			},
		});
	});

	it("expires and grants on subscription_cycle invoices", async () => {
		const { credits, processor, stripe } = setup();
		const invoice = stripeInvoice({
			billingReason: "subscription_cycle",
			id: "in_cycle",
			lines: [
				invoiceLine({
					lookupKey: "business_200_month",
				}),
			],
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);

		await processor.process(paidInvoiceEvent(invoice.id, "evt_cycle"));

		expect(credits.expirePlanRemainder).toHaveBeenCalledWith("user_1", {
			idempotencyKey: "inv:in_cycle:expire",
			meta: {
				invoiceId: "in_cycle",
				reason: "subscription_cycle_expire",
			},
		});
		expect(credits.grant).toHaveBeenCalledWith("user_1", 200, {
			bucket: "plan",
			idempotencyKey: "inv:in_cycle:grant",
			meta: {
				invoiceId: "in_cycle",
				reason: "subscription_cycle",
			},
		});
	});

	it("grants only the same-interval subscription_update upgrade delta", async () => {
		const { credits, processor, stripe } = setup();
		const subscription = stripeSubscription({
			id: "sub_update",
			lookupKey: "pro_2000_month",
			userId: "user_1",
		});
		const invoice = stripeInvoice({
			billingReason: "subscription_update",
			id: "in_upgrade",
			lines: [
				invoiceLine({
					amount: -1_200,
					lookupKey: "pro_1200_month",
					proration: true,
				}),
				invoiceLine({
					amount: 1_000,
					lookupKey: "pro_2000_month",
					proration: true,
				}),
			],
			subscription: subscription.id,
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);
		stripe.subscriptions.set(subscription.id, subscription);

		await processor.process(paidInvoiceEvent(invoice.id, "evt_upgrade"));

		expect(credits.grant).toHaveBeenCalledWith("user_1", 800, {
			bucket: "plan",
			idempotencyKey: "inv:in_upgrade:grant",
			meta: {
				invoiceId: "in_upgrade",
				newPriceLookupKey: "pro_2000_month",
				oldPriceLookupKey: "pro_1200_month",
				reason: "subscription_update",
			},
		});
		expect(credits.expirePlanRemainder).not.toHaveBeenCalled();
		expect(credits.expireAmount).not.toHaveBeenCalled();
	});

	it("expires only the same-interval subscription_update downgrade delta", async () => {
		const { credits, processor, stripe } = setup();
		const subscription = stripeSubscription({
			id: "sub_update",
			lookupKey: "pro_400_month",
			userId: "user_1",
		});
		const invoice = stripeInvoice({
			billingReason: "subscription_update",
			id: "in_downgrade",
			lines: [
				invoiceLine({
					amount: -1_200,
					lookupKey: "pro_1200_month",
					proration: true,
				}),
				invoiceLine({
					amount: 100,
					lookupKey: "pro_400_month",
					proration: true,
				}),
			],
			subscription: subscription.id,
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);
		stripe.subscriptions.set(subscription.id, subscription);

		await processor.process(paidInvoiceEvent(invoice.id, "evt_downgrade"));

		expect(credits.expireAmount).toHaveBeenCalledWith("user_1", 800, {
			idempotencyKey: "inv:in_downgrade:expire",
			meta: {
				invoiceId: "in_downgrade",
				newPriceLookupKey: "pro_400_month",
				oldPriceLookupKey: "pro_1200_month",
				reason: "subscription_update",
			},
		});
		expect(credits.grant).not.toHaveBeenCalled();
		expect(credits.expirePlanRemainder).not.toHaveBeenCalled();
	});

	it("falls back to expire-and-full-grant when subscription_update changes interval", async () => {
		const { credits, processor, stripe } = setup();
		const subscription = stripeSubscription({
			id: "sub_update",
			lookupKey: "pro_100_year",
			userId: "user_1",
		});
		const invoice = stripeInvoice({
			billingReason: "subscription_update",
			id: "in_interval",
			lines: [
				invoiceLine({
					amount: -500,
					lookupKey: "pro_100_month",
					proration: true,
				}),
				invoiceLine({
					amount: 500,
					lookupKey: "pro_100_year",
					proration: true,
				}),
			],
			subscription: subscription.id,
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);
		stripe.subscriptions.set(subscription.id, subscription);

		await processor.process(paidInvoiceEvent(invoice.id, "evt_interval"));

		expect(credits.expirePlanRemainder).toHaveBeenCalledWith("user_1", {
			idempotencyKey: "inv:in_interval:expire",
			meta: {
				invoiceId: "in_interval",
				reason: "subscription_update_interval_change",
			},
		});
		expect(credits.grant).toHaveBeenCalledWith("user_1", 1200, {
			bucket: "plan",
			idempotencyKey: "inv:in_interval:grant",
			meta: {
				invoiceId: "in_interval",
				reason: "subscription_update_full_grant",
			},
		});
	});

	it("expires plan credits when a subscription is deleted", async () => {
		const { credits, processor } = setup();
		const subscription = stripeSubscription({
			id: "sub_deleted",
			lookupKey: "pro_100_month",
			userId: "user_1",
		});

		await processor.process(
			stripeEvent(
				"customer.subscription.deleted",
				subscription as unknown as Record<string, unknown>,
				"evt_deleted",
			),
		);

		expect(credits.expirePlanRemainder).toHaveBeenCalledWith("user_1", {
			idempotencyKey: "subdel:sub_deleted",
			meta: {
				providerSubscriptionId: "sub_deleted",
				reason: "subscription_ended",
			},
		});
	});

	it("revokes refunded purchased credits matching the payment intent", async () => {
		const { billingCreditLedger, credits, processor } = setup();
		billingCreditLedger.seed("pi_refund", [
			{ delta: 500, userId: "user_1" },
			{ delta: 250, userId: "user_1" },
		]);

		await processor.process(
			stripeEvent(
				"charge.refunded",
				{
					id: "ch_1",
					payment_intent: "pi_refund",
				},
				"evt_refund",
			),
		);

		expect(credits.revoke).toHaveBeenCalledWith("user_1", 750, {
			idempotencyKey: "refund:ch_1",
			meta: {
				chargeId: "ch_1",
				paymentIntentId: "pi_refund",
				reason: "charge_refunded",
			},
		});
	});

	it("skips refunds without matching positive purchased-credit rows", async () => {
		const { credits, processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent(
				"charge.refunded",
				{
					id: "ch_1",
					payment_intent: "pi_refund",
				},
				"evt_refund_empty",
			),
		);

		expect(credits.revoke).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_refund_empty")).toBe("skipped");
	});

	it("marks failed and rethrows when a handler throws", async () => {
		const { credits, processor, webhookEvents } = setup();
		const error = new Error("top-up failed");
		credits.topup.mockRejectedValueOnce(error);

		await expect(
			processor.process(
				stripeEvent(
					"checkout.session.completed",
					checkoutSession({
						credits: "500",
						id: "cs_1",
						mode: "payment",
						packId: "topup_500",
						userId: "user_1",
					}) as unknown as Record<string, unknown>,
					"evt_throw",
				),
			),
		).rejects.toBe(error);

		expect(webhookEvents.markFailed).toHaveBeenCalledWith(
			"evt_throw",
			"top-up failed",
		);
		expect(webhookEvents.statusOf("evt_throw")).toBe("failed");
		expect(webhookEvents.errorOf("evt_throw")).toBe("top-up failed");
	});

	it("marks unknown event types as skipped", async () => {
		const { processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent("price.created", { id: "price_1" }, "evt_unknown"),
		);

		expect(webhookEvents.markSkipped).toHaveBeenCalledWith("evt_unknown");
		expect(webhookEvents.statusOf("evt_unknown")).toBe("skipped");
	});
});
