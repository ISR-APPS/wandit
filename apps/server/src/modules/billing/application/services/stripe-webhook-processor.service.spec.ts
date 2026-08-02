import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { CreditsService } from "../../../credits/application/services/credits.service";
import type { PaymentProvider } from "../../domain/ports/payment-provider.port";
import type { WebhookOrderReconciler } from "../../domain/ports/webhook-order-reconciler.port";
import type { WebhookOrderRefundHandler } from "../../domain/ports/webhook-order-refund-handler.port";
import type {
	BillingCreditLedgerRepository,
	BillingCreditLedgerRow,
} from "../../infrastructure/persistence/billing-credit-ledger.repository";
import type { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import type { BillingWebhookEventsRepository } from "../../infrastructure/persistence/billing-webhook-events.repository";
import type {
	SubscriptionRow,
	SubscriptionsRepository,
	UpsertSubscriptionInput,
} from "../../infrastructure/persistence/subscriptions.repository";
import type { StripeProvider } from "../../infrastructure/stripe/stripe.provider";
import { PaymentRefundsService } from "./payment-refunds.service";
import {
	type StripeEventRouteResult,
	StripeEventRouter,
} from "./stripe-event-router.service";
import { StripeSubscriptionSyncService } from "./stripe-subscription-sync.service";
import { StripeWebhookProcessor } from "./stripe-webhook-processor.service";
import { SubscriptionCreditsService } from "./subscription-credits.service";

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

type WebhookStatus =
	| "failed"
	| "processed"
	| "processing"
	| "received"
	| "skipped";

type StoredWebhookEvent = {
	attemptCount: number;
	claimedAt: Date | null;
	createdAt: Date;
	error: string | null;
	eventCreatedAt: Date | null;
	payload: unknown;
	processedAt: Date | null;
	provider: string;
	status: WebhookStatus;
	type: string;
};

const TEST_NOW = Date.UTC(2026, 6, 24, 12);

class FakeWebhookEventsRepository {
	private readonly events = new Map<string, StoredWebhookEvent>();
	private nowMs = TEST_NOW;

	readonly claimOutcomes: boolean[] = [];

	readonly findById = vi.fn(async (id: string) => {
		const event = this.events.get(id);

		return event ? { ...event, id } : null;
	});

	readonly markProcessed = vi.fn(async (id: string, claimedAt: Date) => {
		return this.markTerminal(id, claimedAt, "processed", null);
	});

	readonly markSkipped = vi.fn(
		async (id: string, claimedAt: Date, reason: string | null = null) => {
			return this.markTerminal(id, claimedAt, "skipped", reason);
		},
	);

	readonly markFailed = vi.fn(
		async (id: string, claimedAt: Date, error: string) => {
			return this.markTerminal(id, claimedAt, "failed", error);
		},
	);

	readonly tryClaim = vi.fn(async (id: string) => {
		const existing = this.events.get(id);
		const staleProcessing =
			existing?.status === "processing" &&
			existing.claimedAt !== null &&
			existing.claimedAt.getTime() < this.nowMs - 5 * 60 * 1000;
		const claimable =
			existing?.status === "received" ||
			existing?.status === "failed" ||
			staleProcessing;

		if (!existing || !claimable) {
			this.claimOutcomes.push(false);
			return null;
		}

		const claimedAt = new Date(this.nowMs);
		this.events.set(id, {
			...existing,
			attemptCount: existing.attemptCount + 1,
			claimedAt,
			status: "processing",
		});
		this.claimOutcomes.push(true);

		return claimedAt;
	});

	readonly tryInsertReceived = vi.fn(async (event: Stripe.Event) => {
		if (this.events.has(event.id)) {
			return false;
		}

		this.events.set(event.id, {
			attemptCount: 0,
			claimedAt: null,
			createdAt: new Date(this.nowMs),
			error: null,
			eventCreatedAt: new Date(event.created * 1000),
			payload: event,
			processedAt: null,
			provider: "stripe",
			status: "received",
			type: event.type,
		});

		return true;
	});

	seed(
		id: string,
		status: WebhookStatus,
		options: {
			attemptCount?: number;
			claimedAt?: Date | null;
			type?: string;
		} = {},
	) {
		this.events.set(id, {
			attemptCount: options.attemptCount ?? 0,
			claimedAt: options.claimedAt ?? null,
			createdAt: new Date(this.nowMs),
			error: null,
			eventCreatedAt: new Date(0),
			payload: {},
			processedAt: null,
			provider: "stripe",
			status,
			type: options.type ?? "invoice.paid",
		});
	}

	statusOf(id: string) {
		return this.events.get(id)?.status;
	}

	errorOf(id: string) {
		return this.events.get(id)?.error;
	}

	attemptCountOf(id: string) {
		return this.events.get(id)?.attemptCount;
	}

	claimedAtOf(id: string) {
		return this.events.get(id)?.claimedAt;
	}

	now() {
		return this.nowMs;
	}

	advanceBy(milliseconds: number) {
		this.nowMs += milliseconds;
	}

	private markTerminal(
		id: string,
		claimedAt: Date,
		status: "failed" | "processed" | "skipped",
		error: string | null,
	) {
		const existing = this.events.get(id);

		if (
			existing?.status !== "processing" ||
			existing.claimedAt?.getTime() !== claimedAt.getTime()
		) {
			return false;
		}

		this.events.set(id, {
			...existing,
			error,
			processedAt: new Date(this.nowMs),
			status,
		});

		return true;
	}
}

type BillingCustomer = {
	createdAt: Date;
	id: string;
	openCheckoutSessionId: string | null;
	provider: string;
	providerCustomerId: string;
	updatedAt: Date;
	userId: string;
};

class FakeBillingCustomersRepository {
	private readonly byProviderCustomerId = new Map<string, BillingCustomer>();

	readonly upsertByUserId = vi.fn(
		async (input: {
			provider: string;
			providerCustomerId: string;
			userId: string;
		}) => {
			const existing = this.byProviderCustomerId.get(input.providerCustomerId);
			const customer = this.customer(
				input,
				existing?.openCheckoutSessionId ?? null,
			);
			this.byProviderCustomerId.set(input.providerCustomerId, customer);

			return customer;
		},
	);

	readonly findByProviderCustomerId = vi.fn(
		async (providerCustomerId: string) =>
			this.byProviderCustomerId.get(providerCustomerId) ?? null,
	);

	readonly clearOpenCheckoutSessionId = vi.fn(async (sessionId: string) => {
		for (const [providerCustomerId, customer] of this.byProviderCustomerId) {
			if (customer.openCheckoutSessionId !== sessionId) {
				continue;
			}

			this.byProviderCustomerId.set(providerCustomerId, {
				...customer,
				openCheckoutSessionId: null,
			});

			return true;
		}

		return false;
	});

	seed(input: {
		openCheckoutSessionId?: string | null;
		provider?: string;
		providerCustomerId: string;
		userId: string;
	}) {
		const customer = this.customer(
			{
				provider: input.provider ?? "stripe",
				providerCustomerId: input.providerCustomerId,
				userId: input.userId,
			},
			input.openCheckoutSessionId ?? null,
		);
		this.byProviderCustomerId.set(input.providerCustomerId, customer);

		return customer;
	}

	private customer(
		input: {
			provider: string;
			providerCustomerId: string;
			userId: string;
		},
		openCheckoutSessionId: string | null,
	): BillingCustomer {
		return {
			...input,
			createdAt: new Date(0),
			id: `bc_${input.userId}`,
			openCheckoutSessionId,
			updatedAt: new Date(0),
		};
	}
}

class FakeSubscriptionsRepository {
	private readonly rows = new Map<string, SubscriptionRow>();

	readonly lockCustomerIds: string[] = [];
	readonly syncTransaction = { kind: "fake-subscription-sync-transaction" };
	readonly upsertClients: unknown[] = [];
	readonly updateStatus = vi.fn(
		async (providerSubscriptionId: string, status: string) => {
			const row = this.rows.get(providerSubscriptionId);

			if (!row) {
				return null;
			}

			const updated = {
				...row,
				status,
				updatedAt: new Date(TEST_NOW),
			};
			this.rows.set(providerSubscriptionId, updated);

			return updated;
		},
	);

	async withStripeCustomerSyncLock<T>(
		providerCustomerId: string,
		fn: (tx: never) => Promise<T>,
	): Promise<T> {
		this.lockCustomerIds.push(providerCustomerId);

		return fn(this.syncTransaction as never);
	}

	async upsertByProviderSubscriptionId(
		input: UpsertSubscriptionInput,
		client?: unknown,
	) {
		this.upsertClients.push(client);
		const row = {
			...input,
			createdAt: new Date(0),
			id: `subrow_${input.providerSubscriptionId}`,
			organizationId: input.organizationId ?? null,
			updatedAt: new Date(TEST_NOW),
		} satisfies SubscriptionRow;
		this.rows.set(input.providerSubscriptionId, row);

		return row;
	}

	async findByProviderSubscriptionId(providerSubscriptionId: string) {
		return this.rows.get(providerSubscriptionId) ?? null;
	}

	async findActiveByUserId(userId: string) {
		return (
			[...this.rows.values()].find(
				(row) =>
					row.userId === userId &&
					row.status !== "canceled" &&
					row.status !== "incomplete_expired",
			) ?? null
		);
	}

	async updateProviderState(input: {
		cancelAtPeriodEnd: boolean;
		currentPeriodEnd: Date;
		currentPeriodStart: Date;
		providerSubscriptionId: string;
		status: string;
	}) {
		const row = this.rows.get(input.providerSubscriptionId);

		if (!row) {
			return null;
		}

		const updated = {
			...row,
			cancelAtPeriodEnd: input.cancelAtPeriodEnd,
			currentPeriodEnd: input.currentPeriodEnd,
			currentPeriodStart: input.currentPeriodStart,
			status: input.status,
			updatedAt: new Date(TEST_NOW),
		};
		this.rows.set(input.providerSubscriptionId, updated);

		return updated;
	}

	seed(input: {
		priceLookupKey: string;
		providerSubscriptionId: string;
		status?: string;
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
			status: input.status ?? "active",
			tierCredits: Number(tierCreditsValue),
			updatedAt: new Date(0),
			userId: input.userId,
		} as SubscriptionRow;
		this.rows.set(input.providerSubscriptionId, row);

		return row;
	}

	row(providerSubscriptionId: string) {
		return this.rows.get(providerSubscriptionId);
	}
}

class FakeBillingCreditLedgerRepository {
	private readonly rows: BillingCreditLedgerRow[] = [];

	readonly withChargeLock = vi.fn(
		async (
			_chargeId: string,
			fn: (tx: Record<string, never>) => Promise<unknown>,
		) => fn({}),
	);

	readonly findPositiveRowsForPayment = vi.fn(
		async (input: { chargeId: string; paymentIntentId: string | null }) =>
			this.rows.filter(
				(row) =>
					(row.kind === "grant" || row.kind === "topup") &&
					row.delta > 0 &&
					this.matchesPayment(row, input),
			),
	);

	readonly findRevocationRowsForPayment = vi.fn(
		async (input: { chargeId: string; paymentIntentId: string | null }) =>
			this.rows.filter(
				(row) =>
					row.kind === "revoke" &&
					row.delta < 0 &&
					this.matchesPayment(row, input),
			),
	);

	seed(
		paymentIntentId: string,
		rows: Array<{
			bucket?: "plan" | "topup";
			chargeId?: string;
			delta: number;
			userId: string;
		}>,
	) {
		for (const [index, row] of rows.entries()) {
			this.rows.push({
				bucket: row.bucket ?? "topup",
				createdAt: new Date(index * 1000),
				delta: row.delta,
				id: `ledger_${paymentIntentId}_${index}`,
				idempotencyKey: null,
				kind: row.bucket === "plan" ? "grant" : "topup",
				meta: {
					...(row.chargeId ? { chargeId: row.chargeId } : {}),
					paymentIntentId,
				},
				organizationId: null,
				userId: row.userId,
			} as BillingCreditLedgerRow);
		}
	}

	private matchesPayment(
		row: BillingCreditLedgerRow,
		input: { chargeId: string; paymentIntentId: string | null },
	) {
		const meta = row.meta as Record<string, unknown>;

		return (
			meta.chargeId === input.chargeId ||
			(meta.chargeId === undefined &&
				input.paymentIntentId !== null &&
				meta.paymentIntentId === input.paymentIntentId)
		);
	}
}

class FakeCreditsService {
	readonly expireAmount = vi.fn(async () => 0);
	readonly expirePlanRemainder = vi.fn(async () => 0);
	readonly grant = vi.fn(async () => undefined);
	readonly revoke = vi.fn(async () => undefined);
	readonly topup = vi.fn(async () => undefined);
}

class FakePaymentProvider {
	private readonly subscriptionsByCustomer = new Map<
		string,
		Stripe.Subscription[]
	>();

	readonly listSubscriptionsForCustomer = vi.fn(
		async (providerCustomerId: string) =>
			this.subscriptionsByCustomer.get(providerCustomerId) ?? [],
	);

	seedSubscriptions(
		providerCustomerId: string,
		subscriptions: Stripe.Subscription[],
	) {
		this.subscriptionsByCustomer.set(providerCustomerId, subscriptions);
	}
}

class FakeStripeProvider {
	readonly charges = new Map<string, Stripe.Charge>();
	readonly disputesByCharge = new Map<string, Stripe.Dispute[]>();
	readonly invoices = new Map<string, Stripe.Invoice>();
	readonly paymentIntents = new Map<string, Stripe.PaymentIntent>();
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

	readonly retrievePaymentIntent = vi.fn(async (paymentIntentId: string) => {
		return (
			this.paymentIntents.get(paymentIntentId) ??
			({
				id: paymentIntentId,
				latest_charge: `ch_${paymentIntentId}`,
				object: "payment_intent",
			} as Stripe.PaymentIntent)
		);
	});

	readonly retrieveCharge = vi.fn(async (chargeId: string) => {
		return (
			this.charges.get(chargeId) ??
			({
				amount_captured: 1_000,
				amount_refunded: 0,
				customer: null,
				disputed: false,
				id: chargeId,
				object: "charge",
				payment_intent: `pi_${chargeId}`,
			} as Stripe.Charge)
		);
	});

	readonly listDisputesForCharge = vi.fn(async (chargeId: string) => {
		return this.disputesByCharge.get(chargeId) ?? [];
	});

	readonly lookupKeyForPriceId = vi.fn(async (priceId: string) => {
		return this.lookupKeyByPriceId.get(priceId) ?? null;
	});
}

function setup(
	orderReconciler?: WebhookOrderReconciler,
	orderRefundHandler: WebhookOrderRefundHandler = {
		handleChargeRefundedByPaymentIntent: vi.fn(async () => false),
		markRefundedByPaymentIntent: vi.fn(async () => false),
		updateRefundStatus: vi.fn(async () => false),
	},
) {
	const webhookEvents = new FakeWebhookEventsRepository();
	const billingCustomers = new FakeBillingCustomersRepository();
	const subscriptions = new FakeSubscriptionsRepository();
	const billingCreditLedger = new FakeBillingCreditLedgerRepository();
	const credits = new FakeCreditsService();
	const paymentProvider = new FakePaymentProvider();
	const stripe = new FakeStripeProvider();
	const analytics = {
		capture: vi.fn(),
	};
	billingCustomers.seed({
		providerCustomerId: "cus_1",
		userId: "user_1",
	});

	const subscriptionSync = new StripeSubscriptionSyncService(
		billingCustomers as unknown as BillingCustomersRepository,
		subscriptions as unknown as SubscriptionsRepository,
		paymentProvider as unknown as PaymentProvider,
	);
	const paymentRefunds = new PaymentRefundsService(
		billingCreditLedger as unknown as BillingCreditLedgerRepository,
		credits as unknown as CreditsService,
		orderRefundHandler,
		stripe as unknown as StripeProvider,
	);
	const subscriptionCredits = new SubscriptionCreditsService(
		billingCustomers as unknown as BillingCustomersRepository,
		subscriptions as unknown as SubscriptionsRepository,
		credits as unknown as CreditsService,
		stripe as unknown as StripeProvider,
		paymentRefunds,
	);
	const router = new StripeEventRouter(
		billingCustomers as unknown as BillingCustomersRepository,
		subscriptionSync,
		subscriptionCredits,
		paymentRefunds,
		orderReconciler,
	);
	const processor = new StripeWebhookProcessor(
		webhookEvents as unknown as BillingWebhookEventsRepository,
		router,
		analytics as unknown as AnalyticsService,
	);

	return {
		analytics,
		billingCreditLedger,
		billingCustomers,
		credits,
		orderRefundHandler,
		paymentProvider,
		paymentRefunds,
		processor,
		router,
		stripe,
		subscriptionCredits,
		subscriptionSync,
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
		created: 1_700_000_000,
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
	customer?: unknown;
	id: string;
	mode: "payment" | "subscription";
	packId?: string;
	plan?: string;
	paymentIntentId?: string;
	paymentStatus?: "no_payment_required" | "paid" | "unpaid";
	purpose?: string;
	userId?: string;
}) {
	return {
		client_reference_id: input.userId ?? null,
		customer: input.customer ?? "cus_1",
		id: input.id,
		metadata: {
			...(input.credits ? { credits: input.credits } : {}),
			...(input.packId ? { packId: input.packId } : {}),
			...(input.plan ? { plan: input.plan } : {}),
			...(input.purpose ? { purpose: input.purpose } : {}),
			...(input.userId ? { userId: input.userId } : {}),
		},
		mode: input.mode,
		payment_intent: input.paymentIntentId ?? null,
		payment_status: input.paymentStatus ?? "paid",
	} as unknown as Stripe.Checkout.Session;
}

function stripeSubscription(input: {
	created?: number;
	customer?: unknown;
	id: string;
	lookupKey: string;
	status?: string;
	userId?: string;
}) {
	return {
		cancel_at_period_end: false,
		created: input.created ?? 100,
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
		status: input.status ?? "active",
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
	amountPaid?: number;
	billingReason:
		| "subscription_create"
		| "subscription_cycle"
		| "subscription_update";
	customer?: unknown;
	id: string;
	lines: Stripe.InvoiceLineItem[];
	paymentIntentId?: string;
	payments?: Array<{
		charge?: string | Stripe.Charge;
		paymentIntent?: string | Stripe.PaymentIntent;
		status: "canceled" | "paid";
	}>;
	subscription?: string | Stripe.Subscription;
	userId?: string;
}) {
	const payments =
		input.payments ??
		(input.paymentIntentId
			? [{ paymentIntent: input.paymentIntentId, status: "paid" as const }]
			: []);

	return {
		amount_paid: input.amountPaid,
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
			data: payments.map((payment) => ({
				payment: {
					...(payment.charge ? { charge: payment.charge } : {}),
					...(payment.paymentIntent
						? { payment_intent: payment.paymentIntent }
						: {}),
				},
				status: payment.status,
			})),
		},
	} as unknown as Stripe.Invoice;
}

function paidInvoiceEvent(
	invoiceId: string,
	eventId = `evt_${invoiceId}`,
	customer: unknown = "cus_1",
) {
	return stripeEvent("invoice.paid", { customer, id: invoiceId }, eventId);
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve;
	});

	return { promise, resolve };
}

describe("StripeWebhookProcessor claim lifecycle", () => {
	it.each([
		"processed",
		"skipped",
	] as const)("does not invoke the router for duplicate %s events", async (status) => {
		const { processor, router, stripe, webhookEvents } = setup();
		const route = vi.spyOn(router, "route");
		webhookEvents.seed("evt_duplicate", status);

		await processor.process(paidInvoiceEvent("in_duplicate", "evt_duplicate"));

		expect(route).not.toHaveBeenCalled();
		expect(stripe.retrieveInvoice).not.toHaveBeenCalled();
		expect(webhookEvents.tryClaim).not.toHaveBeenCalled();
	});

	it.each([
		"received",
		"failed",
	] as const)("reprocesses duplicate %s events", async (status) => {
		const { credits, processor, stripe, webhookEvents } = setup();
		const invoice = stripeInvoice({
			billingReason: "subscription_create",
			id: `in_${status}`,
			lines: [invoiceLine({ lookupKey: "pro_100_month" })],
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);
		webhookEvents.seed(`evt_${status}`, status);

		await processor.process(paidInvoiceEvent(invoice.id, `evt_${status}`));

		expect(credits.grant).toHaveBeenCalledWith(
			"user_1",
			100,
			expect.objectContaining({
				idempotencyKey: `inv:${invoice.id}:grant`,
			}),
		);
		expect(webhookEvents.statusOf(`evt_${status}`)).toBe("processed");
		expect(webhookEvents.attemptCountOf(`evt_${status}`)).toBe(1);
	});

	it("returns a retryable failure when another processor holds a live lease", async () => {
		const { processor, router, webhookEvents } = setup();
		const routeResult = deferred<StripeEventRouteResult>();
		const route = vi
			.spyOn(router, "route")
			.mockImplementationOnce(() => routeResult.promise);
		const event = stripeEvent("price.created", { id: "price_1" }, "evt_race");

		const first = processor.process(event);

		await vi.waitFor(() => {
			expect(webhookEvents.statusOf("evt_race")).toBe("processing");
			expect(route).toHaveBeenCalledTimes(1);
		});

		await expect(processor.process(event)).rejects.toThrow(
			"could not be claimed while status is processing",
		);
		expect(webhookEvents.claimOutcomes).toEqual([true, false]);
		expect(webhookEvents.attemptCountOf("evt_race")).toBe(1);
		expect(route).toHaveBeenCalledTimes(1);

		routeResult.resolve({ status: "processed" });
		await expect(first).resolves.toEqual({ received: true });
		expect(webhookEvents.statusOf("evt_race")).toBe("processed");
	});

	it("does not route and retryably fails an event with a fresh processing lease", async () => {
		const { processor, router, webhookEvents } = setup();
		const route = vi.spyOn(router, "route");
		webhookEvents.seed("evt_fresh", "processing", {
			attemptCount: 2,
			claimedAt: new Date(webhookEvents.now() - 4 * 60 * 1000),
			type: "price.created",
		});

		await expect(
			processor.process(
				stripeEvent("price.created", { id: "price_1" }, "evt_fresh"),
			),
		).rejects.toThrow("could not be claimed while status is processing");

		expect(webhookEvents.claimOutcomes).toEqual([false]);
		expect(webhookEvents.attemptCountOf("evt_fresh")).toBe(2);
		expect(webhookEvents.statusOf("evt_fresh")).toBe("processing");
		expect(route).not.toHaveBeenCalled();
	});

	it.each([
		"received",
		"failed",
	] as const)("retryably fails when a %s row loses the claim race", async (status) => {
		const { processor, router, webhookEvents } = setup();
		const route = vi.spyOn(router, "route");
		webhookEvents.seed("evt_claim_miss", status, {
			type: "price.created",
		});
		webhookEvents.tryClaim.mockResolvedValueOnce(null);

		await expect(
			processor.process(
				stripeEvent("price.created", { id: "price_1" }, "evt_claim_miss"),
			),
		).rejects.toThrow(`could not be claimed while status is ${status}`);
		expect(route).not.toHaveBeenCalled();
	});

	it("acks when a claim miss re-read observes a terminal owner result", async () => {
		const { processor, router, webhookEvents } = setup();
		const route = vi.spyOn(router, "route");
		webhookEvents.seed("evt_terminal_race", "processing", {
			claimedAt: new Date(webhookEvents.now()),
			type: "price.created",
		});
		webhookEvents.tryClaim.mockResolvedValueOnce(null);
		webhookEvents.findById
			.mockResolvedValueOnce({
				id: "evt_terminal_race",
				status: "processing",
			} as never)
			.mockResolvedValueOnce({
				id: "evt_terminal_race",
				status: "processed",
			} as never);

		await expect(
			processor.process(
				stripeEvent("price.created", { id: "price_1" }, "evt_terminal_race"),
			),
		).resolves.toEqual({ received: true });
		expect(route).not.toHaveBeenCalled();
	});

	it("reclaims and routes a processing lease older than five minutes", async () => {
		const { processor, router, webhookEvents } = setup();
		const route = vi.spyOn(router, "route");
		webhookEvents.seed("evt_stale", "processing", {
			attemptCount: 2,
			claimedAt: new Date(webhookEvents.now() - 5 * 60 * 1000 - 1),
			type: "price.created",
		});

		await processor.process(
			stripeEvent("price.created", { id: "price_1" }, "evt_stale"),
		);

		expect(webhookEvents.claimOutcomes).toEqual([true]);
		expect(webhookEvents.attemptCountOf("evt_stale")).toBe(3);
		expect(webhookEvents.claimedAtOf("evt_stale")).toEqual(
			new Date(webhookEvents.now()),
		);
		expect(webhookEvents.statusOf("evt_stale")).toBe("skipped");
		expect(route).toHaveBeenCalledTimes(1);
	});

	it("prevents a stale claimant from terminalizing a stolen lease", async () => {
		const { processor, router, webhookEvents } = setup();
		const firstRoute = deferred<StripeEventRouteResult>();
		const secondRoute = deferred<StripeEventRouteResult>();
		const route = vi
			.spyOn(router, "route")
			.mockImplementationOnce(() => firstRoute.promise)
			.mockImplementationOnce(() => secondRoute.promise);
		const event = stripeEvent("price.created", { id: "price_1" }, "evt_stolen");

		const first = processor.process(event);
		await vi.waitFor(() => {
			expect(route).toHaveBeenCalledTimes(1);
			expect(webhookEvents.statusOf(event.id)).toBe("processing");
		});

		webhookEvents.advanceBy(5 * 60 * 1000 + 1);
		const second = processor.process(event);
		await vi.waitFor(() => {
			expect(route).toHaveBeenCalledTimes(2);
			expect(webhookEvents.attemptCountOf(event.id)).toBe(2);
		});

		firstRoute.resolve({ status: "processed" });
		await expect(first).rejects.toThrow(
			"lost claim ownership while durable status is processing",
		);
		expect(webhookEvents.statusOf(event.id)).toBe("processing");

		secondRoute.resolve({
			reason: "current claimant result",
			status: "skipped",
		});
		await expect(second).resolves.toEqual({ received: true });
		expect(webhookEvents.statusOf(event.id)).toBe("skipped");
	});

	it("acks a stale claimant only after the current owner reaches a terminal state", async () => {
		const { processor, router, webhookEvents } = setup();
		const firstRoute = deferred<StripeEventRouteResult>();
		const secondRoute = deferred<StripeEventRouteResult>();
		const route = vi
			.spyOn(router, "route")
			.mockImplementationOnce(() => firstRoute.promise)
			.mockImplementationOnce(() => secondRoute.promise);
		const event = stripeEvent(
			"price.created",
			{ id: "price_1" },
			"evt_stolen_terminal",
		);

		const first = processor.process(event);
		await vi.waitFor(() => {
			expect(route).toHaveBeenCalledTimes(1);
		});

		webhookEvents.advanceBy(5 * 60 * 1000 + 1);
		const second = processor.process(event);
		await vi.waitFor(() => {
			expect(route).toHaveBeenCalledTimes(2);
		});

		secondRoute.resolve({
			reason: "current claimant result",
			status: "skipped",
		});
		await expect(second).resolves.toEqual({ received: true });

		firstRoute.resolve({ status: "processed" });
		await expect(first).resolves.toEqual({ received: true });
		expect(webhookEvents.statusOf(event.id)).toBe("skipped");
	});

	it("marks failed and rethrows when a routed handler throws", async () => {
		const { credits, processor, webhookEvents } = setup();
		const error = new Error("top-up failed");
		credits.topup.mockRejectedValueOnce(error);

		await expect(
			processor.process(
				stripeEvent(
					"checkout.session.completed",
					checkoutSession({
						credits: "500",
						id: "cs_throw",
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
			expect.any(Date),
			"top-up failed",
		);
		expect(webhookEvents.statusOf("evt_throw")).toBe("failed");
		expect(webhookEvents.errorOf("evt_throw")).toBe("top-up failed");
	});

	it("marks unknown event types as skipped with a reason", async () => {
		const { processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent("price.created", { id: "price_1" }, "evt_unknown"),
		);

		expect(webhookEvents.markSkipped).toHaveBeenCalledWith(
			"evt_unknown",
			expect.any(Date),
			"Stripe event type price.created is not allowlisted",
		);
		expect(webhookEvents.statusOf("evt_unknown")).toBe("skipped");
	});
});

describe("StripeEventRouter checkout routing", () => {
	it("handles a legacy payment-mode checkout as a top-up", async () => {
		const { credits, paymentRefunds, processor, stripe } = setup();
		const reconcileChargeAfterGrant = vi.spyOn(
			paymentRefunds,
			"reconcileChargeAfterGrant",
		);

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
				chargeId: "ch_pi_1",
				packId: "topup_500",
				paymentIntentId: "pi_1",
				reason: "topup_purchase",
				sessionId: "cs_1",
			},
		});
		expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith("pi_1");
		expect(reconcileChargeAfterGrant).toHaveBeenCalledWith("ch_pi_1");
	});

	it("handles an explicitly purposed async success as a top-up", async () => {
		const { credits, processor, stripe } = setup();

		await processor.process(
			stripeEvent(
				"checkout.session.async_payment_succeeded",
				checkoutSession({
					credits: "1000",
					id: "cs_async",
					mode: "payment",
					packId: "topup_1000",
					paymentIntentId: "pi_async",
					purpose: "topup",
					userId: "user_1",
				}) as unknown as Record<string, unknown>,
				"evt_async_topup",
			),
		);

		expect(credits.topup).toHaveBeenCalledWith("user_1", 1000, {
			idempotencyKey: "topup:cs_async",
			meta: {
				chargeId: "ch_pi_async",
				packId: "topup_1000",
				paymentIntentId: "pi_async",
				reason: "topup_purchase",
				sessionId: "cs_async",
			},
		});
		expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith("pi_async");
	});

	it("skips an unpaid top-up without granting credits", async () => {
		const { credits, processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent(
				"checkout.session.completed",
				checkoutSession({
					credits: "500",
					id: "cs_unpaid",
					mode: "payment",
					packId: "topup_500",
					paymentStatus: "unpaid",
					purpose: "topup",
					userId: "user_1",
				}) as unknown as Record<string, unknown>,
				"evt_unpaid",
			),
		);

		expect(credits.topup).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_unpaid")).toBe("skipped");
		expect(webhookEvents.errorOf("evt_unpaid")).toBe(
			"Stripe top-up checkout session cs_unpaid is not paid",
		);
	});

	it("does not fall back to top-up heuristics for an unknown explicit purpose", async () => {
		const { credits, processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent(
				"checkout.session.completed",
				checkoutSession({
					credits: "500",
					id: "cs_unknown_purpose",
					mode: "payment",
					packId: "topup_500",
					purpose: "domain",
					userId: "user_1",
				}) as unknown as Record<string, unknown>,
				"evt_unknown_purpose",
			),
		);

		expect(credits.topup).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_unknown_purpose")).toBe("skipped");
	});

	it("skips unrelated legacy payment-mode checkouts", async () => {
		const { credits, processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent(
				"checkout.session.completed",
				checkoutSession({
					id: "cs_unrelated",
					mode: "payment",
					userId: "user_1",
				}) as unknown as Record<string, unknown>,
				"evt_unrelated",
			),
		);

		expect(credits.topup).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_unrelated")).toBe("skipped");
	});

	it("maps and synchronizes a subscription checkout", async () => {
		const {
			analytics,
			billingCustomers,
			paymentProvider,
			processor,
			subscriptions,
		} = setup();
		billingCustomers.seed({
			openCheckoutSessionId: "cs_subscription",
			providerCustomerId: "cus_checkout",
			userId: "user_checkout",
		});
		const subscription = stripeSubscription({
			customer: "cus_checkout",
			id: "sub_checkout",
			lookupKey: "pro_100_month",
		});
		paymentProvider.seedSubscriptions("cus_checkout", [subscription]);

		const event = stripeEvent(
			"checkout.session.completed",
			checkoutSession({
				customer: "cus_checkout",
				id: "cs_subscription",
				mode: "subscription",
				plan: "pro",
				purpose: "subscription",
				userId: "user_checkout",
			}) as unknown as Record<string, unknown>,
			"evt_subscription_checkout",
		);
		await processor.process(event);
		await processor.process(event);

		expect(billingCustomers.upsertByUserId).toHaveBeenCalledWith({
			provider: "stripe",
			providerCustomerId: "cus_checkout",
			userId: "user_checkout",
		});
		expect(billingCustomers.clearOpenCheckoutSessionId).toHaveBeenCalledWith(
			"cs_subscription",
		);
		expect(paymentProvider.listSubscriptionsForCustomer).toHaveBeenCalledWith(
			"cus_checkout",
		);
		expect(subscriptions.row("sub_checkout")?.userId).toBe("user_checkout");
		expect(analytics.capture).toHaveBeenCalledOnce();
		expect(analytics.capture).toHaveBeenCalledWith(
			"user_checkout",
			"subscription_started",
			{ plan: "pro" },
		);
	});

	it("does not capture when subscription checkout mirrors no subscription", async () => {
		const { analytics, processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent(
				"checkout.session.completed",
				checkoutSession({
					customer: "cus_empty",
					id: "cs_subscription_empty",
					mode: "subscription",
					plan: "pro",
					purpose: "subscription",
					userId: "user_empty",
				}) as unknown as Record<string, unknown>,
				"evt_subscription_empty",
			),
		);

		expect(webhookEvents.statusOf("evt_subscription_empty")).toBe("processed");
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("does not capture an unrecognized Stripe subscription price", async () => {
		const { analytics, paymentProvider, processor, webhookEvents } = setup();
		paymentProvider.seedSubscriptions("cus_unrecognized", [
			stripeSubscription({
				customer: "cus_unrecognized",
				id: "sub_unrecognized",
				lookupKey: "future_plan",
			}),
		]);

		await processor.process(
			stripeEvent(
				"checkout.session.completed",
				checkoutSession({
					customer: "cus_unrecognized",
					id: "cs_subscription_unrecognized",
					mode: "subscription",
					plan: "pro",
					purpose: "subscription",
					userId: "user_unrecognized",
				}) as unknown as Record<string, unknown>,
				"evt_subscription_unrecognized",
			),
		);

		expect(webhookEvents.statusOf("evt_subscription_unrecognized")).toBe(
			"processed",
		);
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("does not capture when the mirrored subscription is not active or trialing", async () => {
		const { analytics, paymentProvider, processor, webhookEvents } = setup();
		paymentProvider.seedSubscriptions("cus_canceled", [
			stripeSubscription({
				customer: "cus_canceled",
				id: "sub_canceled",
				lookupKey: "pro_100_month",
				status: "canceled",
			}),
		]);

		await processor.process(
			stripeEvent(
				"checkout.session.completed",
				checkoutSession({
					customer: "cus_canceled",
					id: "cs_subscription_canceled",
					mode: "subscription",
					plan: "pro",
					purpose: "subscription",
					userId: "user_canceled",
				}) as unknown as Record<string, unknown>,
				"evt_subscription_canceled",
			),
		);

		expect(webhookEvents.statusOf("evt_subscription_canceled")).toBe(
			"processed",
		);
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("does not capture a subscription whose persistence fails", async () => {
		const { analytics, paymentProvider, processor, webhookEvents } = setup();
		paymentProvider.listSubscriptionsForCustomer.mockRejectedValueOnce(
			new Error("Stripe unavailable"),
		);

		await expect(
			processor.process(
				stripeEvent(
					"checkout.session.completed",
					checkoutSession({
						id: "cs_subscription_failed",
						mode: "subscription",
						plan: "pro",
						purpose: "subscription",
						userId: "user_1",
					}) as unknown as Record<string, unknown>,
					"evt_subscription_failed",
				),
			),
		).rejects.toThrow("Stripe unavailable");
		expect(webhookEvents.statusOf("evt_subscription_failed")).toBe("failed");
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("clears a stored subscription attempt when its checkout expires", async () => {
		const { billingCustomers, paymentProvider, processor, webhookEvents } =
			setup();
		billingCustomers.seed({
			openCheckoutSessionId: "cs_expired_subscription",
			providerCustomerId: "cus_1",
			userId: "user_1",
		});

		await processor.process(
			stripeEvent(
				"checkout.session.expired",
				checkoutSession({
					id: "cs_expired_subscription",
					mode: "subscription",
					purpose: "subscription",
					userId: "user_1",
				}) as unknown as Record<string, unknown>,
				"evt_expired_subscription",
			),
		);

		expect(billingCustomers.clearOpenCheckoutSessionId).toHaveBeenCalledWith(
			"cs_expired_subscription",
		);
		expect(paymentProvider.listSubscriptionsForCustomer).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_expired_subscription")).toBe(
			"processed",
		);
	});

	it("does not clear a newer subscription attempt when an older checkout expires", async () => {
		const { billingCustomers, processor } = setup();
		billingCustomers.seed({
			openCheckoutSessionId: "cs_newer_subscription",
			providerCustomerId: "cus_1",
			userId: "user_1",
		});

		await processor.process(
			stripeEvent(
				"checkout.session.expired",
				checkoutSession({
					id: "cs_older_subscription",
					mode: "subscription",
					purpose: "subscription",
					userId: "user_1",
				}) as unknown as Record<string, unknown>,
				"evt_expired_older_subscription",
			),
		);

		await expect(
			billingCustomers.findByProviderCustomerId("cus_1"),
		).resolves.toMatchObject({
			openCheckoutSessionId: "cs_newer_subscription",
		});
	});

	it.each([
		"checkout.session.completed",
		"checkout.session.async_payment_failed",
		"checkout.session.expired",
	] as const)("skips the %s order seam while no reconciler is registered", async (eventType) => {
		const { processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent(
				eventType,
				checkoutSession({
					id: `cs_order_${eventType}`,
					mode: "payment",
					purpose: "order",
				}) as unknown as Record<string, unknown>,
				`evt_order_${eventType}`,
			),
		);

		expect(webhookEvents.statusOf(`evt_order_${eventType}`)).toBe("skipped");
		expect(webhookEvents.errorOf(`evt_order_${eventType}`)).toContain(
			"deferred to Phase I3",
		);
	});

	it.each([
		["checkout.session.completed", "completed"],
		["checkout.session.async_payment_succeeded", "async_payment_succeeded"],
		["checkout.session.async_payment_failed", "async_payment_failed"],
		["checkout.session.expired", "expired"],
	] as const)("reconciles a %s order checkout through the registered port", async (eventType, outcome) => {
		const orderReconciler = {
			reconcileByPaymentIntent: vi.fn(async () => true),
			reconcileBySession: vi.fn(async () => undefined),
		};
		const { processor, webhookEvents } = setup(orderReconciler);
		const checkoutId = `cs_order_${eventType}`;
		const eventId = `evt_order_registered_${eventType}`;

		await processor.process(
			stripeEvent(
				eventType,
				checkoutSession({
					id: checkoutId,
					mode: "payment",
					purpose: "order",
				}) as unknown as Record<string, unknown>,
				eventId,
			),
		);

		expect(orderReconciler.reconcileBySession).toHaveBeenCalledWith(
			checkoutId,
			outcome,
		);
		expect(webhookEvents.statusOf(eventId)).toBe("processed");
	});
});

describe("StripeEventRouter subscription synchronization", () => {
	const subscriptionEventTypes = [
		"customer.subscription.created",
		"customer.subscription.updated",
		"customer.subscription.deleted",
		"customer.subscription.paused",
		"customer.subscription.resumed",
		"customer.subscription.pending_update_applied",
		"customer.subscription.pending_update_expired",
		"customer.subscription.trial_will_end",
	] as const;

	it.each(
		subscriptionEventTypes,
	)("synchronizes %s through the real sync service", async (eventType) => {
		const {
			credits,
			paymentProvider,
			processor,
			subscriptions,
			webhookEvents,
		} = setup();
		const providerSubscription = stripeSubscription({
			id: `sub_${eventType}`,
			lookupKey: "business_200_month",
			status:
				eventType === "customer.subscription.deleted" ? "canceled" : "active",
			userId: "user_1",
		});
		paymentProvider.seedSubscriptions("cus_1", [providerSubscription]);

		await processor.process(
			stripeEvent(
				eventType,
				providerSubscription as unknown as Record<string, unknown>,
				`evt_${eventType}`,
			),
		);

		expect(paymentProvider.listSubscriptionsForCustomer).toHaveBeenCalledWith(
			"cus_1",
		);
		expect(subscriptions.lockCustomerIds).toEqual(["cus_1"]);
		expect(subscriptions.row(providerSubscription.id)).toMatchObject({
			plan: "business",
			priceLookupKey: "business_200_month",
			tierCredits: 200,
			userId: "user_1",
		});
		expect(subscriptions.upsertClients).toEqual([
			subscriptions.syncTransaction,
		]);
		expect(webhookEvents.statusOf(`evt_${eventType}`)).toBe("processed");

		if (eventType === "customer.subscription.deleted") {
			expect(credits.expirePlanRemainder).toHaveBeenCalledWith("user_1", {
				idempotencyKey: `subdel:${providerSubscription.id}`,
				meta: {
					providerSubscriptionId: providerSubscription.id,
					reason: "subscription_ended",
				},
			});
		} else {
			expect(credits.expirePlanRemainder).not.toHaveBeenCalled();
		}
	});

	it("marks malformed non-string subscription customers failed and rethrows", async () => {
		const { paymentProvider, processor, webhookEvents } = setup();
		const subscription = stripeSubscription({
			customer: { id: "cus_expanded" },
			id: "sub_bad_customer",
			lookupKey: "pro_100_month",
		});

		await expect(
			processor.process(
				stripeEvent(
					"customer.subscription.updated",
					subscription as unknown as Record<string, unknown>,
					"evt_bad_customer",
				),
			),
		).rejects.toThrow(
			"Stripe subscription sub_bad_customer customer must be a string",
		);

		expect(paymentProvider.listSubscriptionsForCustomer).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_bad_customer")).toBe("failed");
		expect(webhookEvents.errorOf("evt_bad_customer")).toBe(
			"Stripe subscription sub_bad_customer customer must be a string",
		);
	});
});

describe("StripeEventRouter invoice allowlist", () => {
	const invoiceEventTypes = [
		"invoice.paid",
		"invoice.payment_failed",
		"invoice.payment_action_required",
		"invoice.marked_uncollectible",
		"invoice.upcoming",
	] as const;

	it.each(
		invoiceEventTypes,
	)("synchronizes %s and only grants for invoice.paid", async (eventType) => {
		const {
			credits,
			paymentProvider,
			processor,
			stripe,
			subscriptions,
			webhookEvents,
		} = setup();
		const invoiceId = `in_${eventType}`;

		if (eventType === "invoice.paid") {
			const invoice = stripeInvoice({
				billingReason: "subscription_create",
				id: invoiceId,
				lines: [invoiceLine({ lookupKey: "pro_100_month" })],
				userId: "user_1",
			});
			stripe.invoices.set(invoice.id, invoice);
		}

		await processor.process(
			stripeEvent(
				eventType,
				{ customer: "cus_1", id: invoiceId },
				`evt_${eventType}`,
			),
		);

		expect(paymentProvider.listSubscriptionsForCustomer).toHaveBeenCalledWith(
			"cus_1",
		);
		expect(webhookEvents.statusOf(`evt_${eventType}`)).toBe("processed");

		if (eventType === "invoice.paid") {
			expect(credits.grant).toHaveBeenCalledWith(
				"user_1",
				100,
				expect.objectContaining({
					idempotencyKey: `inv:${invoiceId}:grant`,
				}),
			);
		} else {
			expect(credits.grant).not.toHaveBeenCalled();
			expect(stripe.retrieveInvoice).not.toHaveBeenCalled();
		}

		if (eventType === "invoice.payment_failed") {
			expect(subscriptions.updateStatus).not.toHaveBeenCalled();
			expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
		}
	});
});

describe("SubscriptionCreditsService invoice policy", () => {
	it("grants a yearly subscription_create invoice allotment", async () => {
		const { credits, paymentRefunds, processor, stripe } = setup();
		const reconcileChargeAfterGrant = vi.spyOn(
			paymentRefunds,
			"reconcileChargeAfterGrant",
		);
		const invoice = stripeInvoice({
			billingReason: "subscription_create",
			id: "in_create",
			lines: [invoiceLine({ lookupKey: "pro_100_year" })],
			paymentIntentId: "pi_invoice_create",
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);

		await processor.process(paidInvoiceEvent(invoice.id, "evt_create"));

		expect(credits.grant).toHaveBeenCalledWith("user_1", 1200, {
			bucket: "plan",
			idempotencyKey: "inv:in_create:grant",
			meta: {
				chargeId: "ch_pi_invoice_create",
				invoiceId: "in_create",
				paymentIntentId: "pi_invoice_create",
				reason: "subscription_initial",
			},
		});
		expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith(
			"pi_invoice_create",
		);
		expect(reconcileChargeAfterGrant).toHaveBeenCalledWith(
			"ch_pi_invoice_create",
		);
	});

	it("ignores canceled invoice payments and associates the paid payment intent and charge", async () => {
		const { credits, paymentRefunds, processor, stripe } = setup();
		const reconcileChargeAfterGrant = vi.spyOn(
			paymentRefunds,
			"reconcileChargeAfterGrant",
		);
		const invoice = stripeInvoice({
			amountPaid: 1_000,
			billingReason: "subscription_create",
			id: "in_retry_payment",
			lines: [invoiceLine({ lookupKey: "pro_100_month" })],
			payments: [
				{ paymentIntent: "pi_canceled", status: "canceled" },
				{ paymentIntent: "pi_paid", status: "paid" },
			],
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);

		await processor.process(paidInvoiceEvent(invoice.id, "evt_retry_payment"));

		expect(stripe.retrievePaymentIntent).toHaveBeenCalledOnce();
		expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith("pi_paid");
		expect(credits.grant).toHaveBeenCalledWith("user_1", 100, {
			bucket: "plan",
			idempotencyKey: "inv:in_retry_payment:grant",
			meta: {
				chargeId: "ch_pi_paid",
				invoiceId: "in_retry_payment",
				paymentIntentId: "pi_paid",
				reason: "subscription_initial",
			},
		});
		expect(reconcileChargeAfterGrant).toHaveBeenCalledWith("ch_pi_paid");
	});

	it("fails loudly instead of granting against an arbitrary one of multiple paid sources", async () => {
		const { credits, paymentRefunds, processor, stripe, webhookEvents } =
			setup();
		const reconcileChargeAfterGrant = vi.spyOn(
			paymentRefunds,
			"reconcileChargeAfterGrant",
		);
		const invoice = stripeInvoice({
			amountPaid: 1_000,
			billingReason: "subscription_create",
			id: "in_multiple_paid",
			lines: [invoiceLine({ lookupKey: "pro_100_month" })],
			payments: [
				{ paymentIntent: "pi_paid_1", status: "paid" },
				{ paymentIntent: "pi_paid_2", status: "paid" },
			],
			userId: "user_1",
		});
		stripe.invoices.set(invoice.id, invoice);

		await expect(
			processor.process(paidInvoiceEvent(invoice.id, "evt_multiple_paid")),
		).rejects.toThrow(
			"Stripe invoice in_multiple_paid has multiple paid payment sources; refusing to attach one full credit grant to an arbitrary charge",
		);

		expect(credits.grant).not.toHaveBeenCalled();
		expect(reconcileChargeAfterGrant).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_multiple_paid")).toBe("failed");
		expect(webhookEvents.errorOf("evt_multiple_paid")).toContain(
			"multiple paid payment sources",
		);
	});

	it("expires and grants on subscription_cycle invoices", async () => {
		const { credits, processor, stripe } = setup();
		const invoice = stripeInvoice({
			billingReason: "subscription_cycle",
			id: "in_cycle",
			lines: [invoiceLine({ lookupKey: "business_200_month" })],
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
			status: "canceled",
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
});

describe("PaymentRefundsService routing", () => {
	it("revokes refunded purchased credits matching the payment intent", async () => {
		const { billingCreditLedger, credits, processor } = setup();
		billingCreditLedger.seed("pi_refund", [
			{ chargeId: "ch_1", delta: 500, userId: "user_1" },
			{ chargeId: "ch_1", delta: 250, userId: "user_1" },
		]);

		await processor.process(
			stripeEvent(
				"charge.refunded",
				{
					amount_captured: 1_000,
					amount_refunded: 500,
					id: "ch_1",
					payment_intent: "pi_refund",
				},
				"evt_refund",
			),
		);

		expect(credits.revoke).toHaveBeenCalledWith(
			"user_1",
			375,
			{
				bucket: "topup",
				idempotencyKey: "refund:ch_1:500",
				meta: {
					chargeId: "ch_1",
					paymentIntentId: "pi_refund",
					reason: "charge_refunded",
				},
			},
			expect.anything(),
		);
	});

	it("revokes disputed purchased credits with the existing dispute key", async () => {
		const { billingCreditLedger, credits, processor } = setup();
		billingCreditLedger.seed("pi_dispute", [
			{ chargeId: "ch_dispute", delta: 500, userId: "user_1" },
		]);

		await processor.process(
			stripeEvent(
				"charge.dispute.created",
				{
					charge: "ch_dispute",
					id: "dp_1",
					payment_intent: "pi_dispute",
				},
				"evt_dispute",
			),
		);

		expect(credits.revoke).toHaveBeenCalledWith(
			"user_1",
			500,
			{
				bucket: "topup",
				idempotencyKey: "dispute:dp_1",
				meta: {
					chargeId: "ch_dispute",
					disputeId: "dp_1",
					paymentIntentId: "pi_dispute",
					reason: "charge_dispute_created",
				},
			},
			expect.anything(),
		);
	});

	it("terminally fences a disputed payment order instead of retrying forever", async () => {
		const orderRefundHandler: WebhookOrderRefundHandler = {
			handleChargeRefundedByPaymentIntent: vi.fn(async () => false),
			markRefundedByPaymentIntent: vi.fn(async () => true),
			updateRefundStatus: vi.fn(async () => false),
		};
		const { credits, processor, webhookEvents } = setup(
			undefined,
			orderRefundHandler,
		);

		await processor.process(
			stripeEvent(
				"charge.dispute.created",
				{
					charge: "ch_order_dispute",
					id: "dp_order",
					payment_intent: "pi_order_dispute",
				},
				"evt_order_dispute",
			),
		);

		expect(orderRefundHandler.markRefundedByPaymentIntent).toHaveBeenCalledWith(
			{
				chargeId: "ch_order_dispute",
				cause: "dispute",
				paymentIntentId: "pi_order_dispute",
			},
		);
		expect(credits.revoke).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_order_dispute")).toBe("processed");
	});

	it("keeps an unmatched top-up refund failed until its grant exists, then processes it once", async () => {
		const { billingCreditLedger, credits, processor, webhookEvents } = setup();
		const event = stripeEvent(
			"charge.refunded",
			{
				amount_captured: 1_000,
				amount_refunded: 500,
				customer: "cus_1",
				id: "ch_delayed_grant",
				metadata: { purpose: "topup" },
				payment_intent: "pi_delayed_grant",
			},
			"evt_delayed_grant",
		);

		await expect(processor.process(event)).rejects.toThrow(
			"Stripe topup charge ch_delayed_grant has no payment order or credit grant yet",
		);
		expect(webhookEvents.statusOf("evt_delayed_grant")).toBe("failed");
		expect(webhookEvents.attemptCountOf("evt_delayed_grant")).toBe(1);
		expect(credits.revoke).not.toHaveBeenCalled();

		billingCreditLedger.seed("pi_delayed_grant", [
			{
				chargeId: "ch_delayed_grant",
				delta: 500,
				userId: "user_1",
			},
		]);

		await processor.process(event);
		await processor.process(event);

		expect(webhookEvents.statusOf("evt_delayed_grant")).toBe("processed");
		expect(webhookEvents.attemptCountOf("evt_delayed_grant")).toBe(2);
		expect(credits.revoke).toHaveBeenCalledOnce();
		expect(credits.revoke).toHaveBeenCalledWith(
			"user_1",
			250,
			{
				bucket: "topup",
				idempotencyKey: "refund:ch_delayed_grant:500",
				meta: {
					chargeId: "ch_delayed_grant",
					paymentIntentId: "pi_delayed_grant",
					reason: "charge_refunded",
				},
			},
			expect.anything(),
		);
	});

	it("skips an unrecognized refund without matching purchased-credit rows", async () => {
		const { credits, processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent(
				"charge.refunded",
				{
					amount_captured: 1_000,
					amount_refunded: 500,
					customer: "cus_external",
					id: "ch_empty",
					payment_intent: "pi_refund",
				},
				"evt_refund_empty",
			),
		);

		expect(credits.revoke).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_refund_empty")).toBe("skipped");
	});

	it("marks an order-only charge refund processed without touching credits", async () => {
		const orderRefundHandler: WebhookOrderRefundHandler = {
			handleChargeRefundedByPaymentIntent: vi.fn(async () => true),
			markRefundedByPaymentIntent: vi.fn(async () => false),
			updateRefundStatus: vi.fn(async () => true),
		};
		const { credits, processor, webhookEvents } = setup(
			undefined,
			orderRefundHandler,
		);

		await processor.process(
			stripeEvent(
				"charge.refunded",
				{
					amount_captured: 1_000,
					amount_refunded: 1_000,
					id: "ch_order",
					payment_intent: "pi_order",
					refunds: {
						data: [
							{
								amount: 1_000,
								created: 1_700_000_000,
								id: "re_order",
								object: "refund",
								status: "succeeded",
							},
						],
						has_more: false,
						object: "list",
						url: "/v1/charges/ch_order/refunds",
					},
				},
				"evt_order_refund",
			),
		);

		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).toHaveBeenCalledWith({
			amountCaptured: 1_000,
			amountRefunded: 1_000,
			chargeId: "ch_order",
			paymentIntentId: "pi_order",
		});
		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: "pi_order",
			providerRefundId: "re_order",
			refundStatus: "succeeded",
		});
		expect(credits.revoke).not.toHaveBeenCalled();
		expect(webhookEvents.statusOf("evt_order_refund")).toBe("processed");
	});

	it.each([
		["charge.refund.updated", "pending"],
		["refund.updated", "succeeded"],
		["refund.failed", "failed"],
	] as const)("routes %s through the persisted order-refund lifecycle", async (eventType, refundStatus) => {
		const orderRefundHandler: WebhookOrderRefundHandler = {
			handleChargeRefundedByPaymentIntent: vi.fn(async () => true),
			markRefundedByPaymentIntent: vi.fn(async () => false),
			updateRefundStatus: vi.fn(async () => true),
		};
		const { processor, stripe, webhookEvents } = setup(
			undefined,
			orderRefundHandler,
		);
		const eventId = `evt_${eventType}`;
		stripe.charges.set("ch_order_refund", {
			amount_captured: 1_000,
			amount_refunded: 1_000,
			id: "ch_order_refund",
			object: "charge",
			payment_intent: "pi_order_refund",
			refunds: {
				data: [
					{
						amount: 1_000,
						created: 1_700_000_000,
						id: "re_succeeded",
						object: "refund",
						status: "succeeded",
					} as Stripe.Refund,
				],
				has_more: false,
				object: "list",
				url: "/v1/charges/ch_order_refund/refunds",
			},
		} as Stripe.Charge);

		await processor.process(
			stripeEvent(
				eventType,
				{
					amount: 1_000,
					charge: "ch_order_refund",
					created: 1_700_000_000,
					id: `re_${refundStatus}`,
					object: "refund",
					payment_intent: "pi_order_refund",
					status: refundStatus,
				},
				eventId,
			),
		);

		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: "pi_order_refund",
			providerRefundId: `re_${refundStatus}`,
			refundStatus,
		});
		expect(webhookEvents.statusOf(eventId)).toBe("processed");
	});

	it("skips an unmatched refund lifecycle event", async () => {
		const { processor, webhookEvents } = setup();

		await processor.process(
			stripeEvent(
				"refund.updated",
				{
					id: "re_unmatched",
					object: "refund",
					payment_intent: null,
					status: "pending",
				},
				"evt_refund_unmatched",
			),
		);

		expect(webhookEvents.statusOf("evt_refund_unmatched")).toBe("skipped");
		expect(webhookEvents.errorOf("evt_refund_unmatched")).toContain(
			"has no matching payment order",
		);
	});
});

describe("StripeEventRouter payment-intent seam", () => {
	it.each([
		"payment_intent.succeeded",
		"payment_intent.payment_failed",
		"payment_intent.canceled",
	] as const)("skips %s while no order reconciler is registered", async (eventType) => {
		const { processor, webhookEvents } = setup();
		const eventId = `evt_${eventType}`;

		await processor.process(
			stripeEvent(eventType, { id: `pi_${eventType}` }, eventId),
		);

		expect(webhookEvents.statusOf(eventId)).toBe("skipped");
		expect(webhookEvents.errorOf(eventId)).toContain("deferred to Phase I3");
	});

	it("processes a payment intent when the registered reconciler finds its order", async () => {
		const orderReconciler = {
			reconcileByPaymentIntent: vi.fn(async () => true),
			reconcileBySession: vi.fn(async () => undefined),
		};
		const { processor, webhookEvents } = setup(orderReconciler);

		await processor.process(
			stripeEvent(
				"payment_intent.succeeded",
				{ id: "pi_order_match" },
				"evt_pi_order_match",
			),
		);

		expect(orderReconciler.reconcileByPaymentIntent).toHaveBeenCalledWith(
			"pi_order_match",
			"succeeded",
			"succeeded",
		);
		expect(webhookEvents.statusOf("evt_pi_order_match")).toBe("processed");
	});

	it("skips a payment intent when the registered reconciler finds no order", async () => {
		const orderReconciler = {
			reconcileByPaymentIntent: vi.fn(async () => false),
			reconcileBySession: vi.fn(async () => undefined),
		};
		const { processor, webhookEvents } = setup(orderReconciler);

		await processor.process(
			stripeEvent(
				"payment_intent.payment_failed",
				{ id: "pi_no_order", status: "requires_payment_method" },
				"evt_pi_no_order",
			),
		);

		expect(orderReconciler.reconcileByPaymentIntent).toHaveBeenCalledWith(
			"pi_no_order",
			"failed",
			"requires_payment_method",
		);
		expect(webhookEvents.statusOf("evt_pi_no_order")).toBe("skipped");
		expect(webhookEvents.errorOf("evt_pi_no_order")).toContain(
			"No payment order matches",
		);
	});

	it("forwards canceled payment intents as canceled order outcomes", async () => {
		const orderReconciler = {
			reconcileByPaymentIntent: vi.fn(async () => true),
			reconcileBySession: vi.fn(async () => undefined),
		};
		const { processor } = setup(orderReconciler);

		await processor.process(
			stripeEvent(
				"payment_intent.canceled",
				{ id: "pi_canceled_order", status: "canceled" },
				"evt_pi_canceled_order",
			),
		);

		expect(orderReconciler.reconcileByPaymentIntent).toHaveBeenCalledWith(
			"pi_canceled_order",
			"canceled",
			"canceled",
		);
	});
});
