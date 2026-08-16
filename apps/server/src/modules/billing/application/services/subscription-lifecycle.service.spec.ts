import { Logger } from "@nestjs/common";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { BillingCheckoutAttemptsRepository } from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import type { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import type {
	BillingPaymentAdjustmentsRepository,
	InsertBillingPaymentAdjustment,
} from "../../infrastructure/persistence/billing-payment-adjustments.repository";
import type { CancellationReasonsRepository } from "../../infrastructure/persistence/cancellation-reasons.repository";
import type { OrganizationBillingCustomersRepository } from "../../infrastructure/persistence/organization-billing-customers.repository";
import type {
	InsertSubscriptionStateEvent,
	SubscriptionStateEventRow,
	SubscriptionStateEventsRepository,
} from "../../infrastructure/persistence/subscription-state-events.repository";
import type {
	SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import type { PaymentRefundsService } from "./payment-refunds.service";
import { StripeEventRouter } from "./stripe-event-router.service";
import type { StripeSubscriptionSyncService } from "./stripe-subscription-sync.service";
import type { SubscriptionCreditsService } from "./subscription-credits.service";
import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";

class InMemoryStateEventsRepository {
	readonly rows: InsertSubscriptionStateEvent[] = [];

	async tryInsert(input: InsertSubscriptionStateEvent): Promise<boolean> {
		if (this.rows.some((row) => row.stripeEventId === input.stripeEventId)) {
			return false;
		}

		this.rows.push({ ...input });
		return true;
	}

	async findByStripeEventId(
		stripeEventId: string,
	): Promise<SubscriptionStateEventRow | null> {
		const row = this.rows.find(
			(candidate) => candidate.stripeEventId === stripeEventId,
		);

		return row
			? ({ ...row, id: `state_${stripeEventId}` } as SubscriptionStateEventRow)
			: null;
	}
}

class InMemoryCancellationReasonsRepository {
	readonly resumedSubscriptions: string[] = [];
	readonly endedLinks: Array<{
		endedStateEventId: string;
		stripeSubscriptionId: string;
	}> = [];
	endLinkError: Error | null = null;

	async markNewestScheduledResumed(
		stripeSubscriptionId: string,
	): Promise<boolean> {
		this.resumedSubscriptions.push(stripeSubscriptionId);
		return true;
	}

	async linkNewestOpenToEnded(
		stripeSubscriptionId: string,
		endedStateEventId: string,
	): Promise<boolean> {
		if (this.endLinkError) {
			throw this.endLinkError;
		}

		this.endedLinks.push({ endedStateEventId, stripeSubscriptionId });
		return true;
	}
}

class InMemoryPaymentAdjustmentsRepository {
	readonly rows: InsertBillingPaymentAdjustment[] = [];
	readonly lockCalls: string[] = [];

	async withStripeObjectLock<T>(
		stripeObjectId: string,
		fn: (tx: object) => Promise<T>,
	): Promise<T> {
		this.lockCalls.push(stripeObjectId);
		return fn({ stripeObjectId });
	}

	async sumRefundIncrementsByStripeObjectId(
		stripeObjectId: string,
	): Promise<number> {
		return this.rows
			.filter(
				(row) => row.kind === "refund" && row.stripeObjectId === stripeObjectId,
			)
			.reduce((sum, row) => sum + row.amountCents, 0);
	}

	async tryInsert(input: InsertBillingPaymentAdjustment): Promise<boolean> {
		if (this.rows.some((row) => row.stripeEventId === input.stripeEventId)) {
			return false;
		}

		this.rows.push({ ...input });
		return true;
	}
}

class InMemorySubscriptionsRepository {
	readonly rows = new Map<string, SubscriptionRow>();

	async findByProviderSubscriptionId(
		providerSubscriptionId: string,
	): Promise<SubscriptionRow | null> {
		return this.rows.get(providerSubscriptionId) ?? null;
	}

	seed(input: {
		cancelAtPeriodEnd?: boolean;
		lookupKey: string;
		organizationId?: string | null;
		providerSubscriptionId: string;
		status?: string;
		userId?: string;
	}): SubscriptionRow {
		const row = {
			cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
			createdAt: new Date(0),
			currentPeriodEnd: new Date(2_000),
			currentPeriodStart: new Date(1_000),
			id: `row_${input.providerSubscriptionId}`,
			interval: "month",
			organizationId: input.organizationId ?? null,
			pendingAppliedBy: null,
			pendingTierCredits: null,
			plan: "pro",
			priceLookupKey: input.lookupKey,
			provider: "stripe",
			providerSubscriptionId: input.providerSubscriptionId,
			status: input.status ?? "active",
			tierCredits: 250,
			updatedAt: new Date(0),
			userId: input.userId ?? "user_1",
		} as SubscriptionRow;
		this.rows.set(row.providerSubscriptionId, row);

		return row;
	}
}

class InMemoryBillingCustomersRepository {
	readonly customers = new Map<
		string,
		{ providerCustomerId: string; userId: string }
	>();

	async findByProviderCustomerId(providerCustomerId: string) {
		return this.customers.get(providerCustomerId) ?? null;
	}
}

class InMemoryOrganizationBillingCustomersRepository {
	readonly customers = new Map<
		string,
		{
			createdByUserId: string;
			organizationId: string;
			providerCustomerId: string;
		}
	>();

	async findByProviderCustomerId(providerCustomerId: string) {
		return this.customers.get(providerCustomerId) ?? null;
	}
}

function setupLifecycle() {
	const stateEvents = new InMemoryStateEventsRepository();
	const paymentAdjustments = new InMemoryPaymentAdjustmentsRepository();
	const subscriptions = new InMemorySubscriptionsRepository();
	const billingCustomers = new InMemoryBillingCustomersRepository();
	const organizationBillingCustomers =
		new InMemoryOrganizationBillingCustomersRepository();
	const cancellationReasons = new InMemoryCancellationReasonsRepository();
	billingCustomers.customers.set("cus_1", {
		providerCustomerId: "cus_1",
		userId: "user_1",
	});
	const lifecycle = new SubscriptionLifecycleService(
		stateEvents as unknown as SubscriptionStateEventsRepository,
		paymentAdjustments as unknown as BillingPaymentAdjustmentsRepository,
		subscriptions as unknown as SubscriptionsRepository,
		billingCustomers as unknown as BillingCustomersRepository,
		organizationBillingCustomers as unknown as OrganizationBillingCustomersRepository,
		cancellationReasons as unknown as CancellationReasonsRepository,
	);

	return {
		billingCustomers,
		cancellationReasons,
		lifecycle,
		organizationBillingCustomers,
		paymentAdjustments,
		stateEvents,
		subscriptions,
	};
}

function stripeEvent(
	type: string,
	object: unknown,
	input: {
		created?: number;
		id?: string;
		previousAttributes?: Record<string, unknown>;
	} = {},
): Stripe.Event {
	return {
		api_version: "2026-07-29.clover",
		created: input.created ?? 1_700_000_000,
		data: {
			object,
			...(input.previousAttributes
				? { previous_attributes: input.previousAttributes }
				: {}),
		},
		id: input.id ?? `evt_${type.replaceAll(".", "_")}`,
		livemode: false,
		object: "event",
		pending_webhooks: 0,
		request: null,
		type,
	} as unknown as Stripe.Event;
}

function stripeSubscription(
	input: {
		cancelAtPeriodEnd?: boolean;
		customer?: unknown;
		id?: string;
		lookupKey?: string;
		status?: string;
	} = {},
): Stripe.Subscription {
	return {
		cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
		customer: input.customer ?? "cus_1",
		id: input.id ?? "sub_1",
		items: subscriptionItems(input.lookupKey ?? "pro_250_month"),
		object: "subscription",
		status: input.status ?? "active",
	} as unknown as Stripe.Subscription;
}

function subscriptionItems(lookupKey: string) {
	return {
		data: [
			{
				id: `si_${lookupKey}`,
				price: {
					id: `price_${lookupKey}`,
					lookup_key: lookupKey,
				},
			},
		],
	};
}

describe("SubscriptionLifecycleService subscription history", () => {
	it("records subscription creation", async () => {
		const { lifecycle, stateEvents } = setupLifecycle();
		const event = stripeEvent(
			"customer.subscription.created",
			stripeSubscription(),
			{ id: "evt_created" },
		);

		await expect(lifecycle.recordEvent(event)).resolves.toEqual({
			inserted: 1,
			skipped: 0,
		});
		expect(stateEvents.rows).toEqual([
			expect.objectContaining({
				kind: "created",
				stripeEventId: "evt_created",
				stripeSubscriptionId: "sub_1",
				toLookupKey: "pro_250_month",
				toStatus: "active",
				userId: "user_1",
			}),
		]);
	});

	it("keeps ownership nullable when no billing owner can be resolved", async () => {
		const { billingCustomers, lifecycle, stateEvents } = setupLifecycle();
		billingCustomers.customers.clear();

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.created",
				stripeSubscription({ customer: "cus_unknown" }),
				{ id: "evt_unresolved_owner" },
			),
		);

		expect(stateEvents.rows[0]).toMatchObject({
			organizationId: null,
			userId: null,
		});
	});

	it("resolves organization ownership from the Stripe customer", async () => {
		const {
			billingCustomers,
			lifecycle,
			organizationBillingCustomers,
			stateEvents,
		} = setupLifecycle();
		billingCustomers.customers.clear();
		organizationBillingCustomers.customers.set("cus_org", {
			createdByUserId: "user_org_creator",
			organizationId: "org_1",
			providerCustomerId: "cus_org",
		});

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.created",
				stripeSubscription({ customer: "cus_org" }),
				{ id: "evt_org_owner" },
			),
		);

		expect(stateEvents.rows[0]).toMatchObject({
			organizationId: "org_1",
			userId: "user_org_creator",
		});
	});

	it("prefers the existing subscription mirror for ownership", async () => {
		const { lifecycle, stateEvents, subscriptions } = setupLifecycle();
		subscriptions.seed({
			lookupKey: "pro_250_month",
			organizationId: "org_existing",
			providerSubscriptionId: "sub_existing_owner",
			userId: "user_existing_owner",
		});

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.updated",
				stripeSubscription({
					customer: "cus_unknown",
					id: "sub_existing_owner",
					status: "past_due",
				}),
				{
					id: "evt_existing_owner",
					previousAttributes: { status: "active" },
				},
			),
		);

		expect(stateEvents.rows[0]).toMatchObject({
			organizationId: "org_existing",
			userId: "user_existing_owner",
		});
	});

	it("does not substitute a mutable mirror for an unresolved payload lookup key", async () => {
		const { lifecycle, stateEvents, subscriptions } = setupLifecycle();
		subscriptions.seed({
			lookupKey: "pro_500_month",
			providerSubscriptionId: "sub_1",
		});

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.created",
				stripeSubscription({ lookupKey: "future_plan" }),
				{ id: "evt_unresolved_lookup" },
			),
		);

		expect(stateEvents.rows[0]).toMatchObject({
			kind: "created",
			toLookupKey: null,
		});
	});

	it.each([
		["up", "pro_250_month", "pro_500_month"],
		["down", "pro_500_month", "pro_250_month"],
	] as const)("records a plan change %s", async (_direction, from, to) => {
		const { lifecycle, stateEvents } = setupLifecycle();
		const event = stripeEvent(
			"customer.subscription.updated",
			stripeSubscription({ lookupKey: to }),
			{
				id: `evt_plan_${_direction}`,
				previousAttributes: { items: subscriptionItems(from) },
			},
		);

		await lifecycle.recordEvent(event);

		expect(stateEvents.rows).toEqual([
			expect.objectContaining({
				fromLookupKey: from,
				kind: "plan_changed",
				toLookupKey: to,
			}),
		]);
	});

	it("records a status change", async () => {
		const { lifecycle, stateEvents } = setupLifecycle();

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.updated",
				stripeSubscription({ status: "past_due" }),
				{
					id: "evt_status",
					previousAttributes: { status: "active" },
				},
			),
		);

		expect(stateEvents.rows[0]).toMatchObject({
			fromStatus: "active",
			kind: "status_changed",
			toStatus: "past_due",
		});
	});

	it.each([
		[false, true, "cancel_scheduled"],
		[true, false, "cancel_unscheduled"],
	] as const)("records cancellation scheduling %s -> %s", async (from, to, kind) => {
		const { lifecycle, stateEvents } = setupLifecycle();

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.updated",
				stripeSubscription({ cancelAtPeriodEnd: to }),
				{
					id: `evt_${kind}`,
					previousAttributes: { cancel_at_period_end: from },
				},
			),
		);

		expect(stateEvents.rows[0]).toMatchObject({ kind });
	});

	it("marks the active cancellation cycle resumed for a cancel_unscheduled event", async () => {
		const { cancellationReasons, lifecycle } = setupLifecycle();

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.updated",
				stripeSubscription({ cancelAtPeriodEnd: false, id: "sub_resumed" }),
				{
					id: "evt_cancel_unscheduled_reason",
					previousAttributes: { cancel_at_period_end: true },
				},
			),
		);

		expect(cancellationReasons.resumedSubscriptions).toEqual(["sub_resumed"]);
	});

	it("records an ended subscription with its last recognized plan", async () => {
		const { lifecycle, stateEvents, subscriptions } = setupLifecycle();
		subscriptions.seed({
			lookupKey: "pro_500_month",
			providerSubscriptionId: "sub_ended",
			status: "active",
		});

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.deleted",
				stripeSubscription({
					id: "sub_ended",
					lookupKey: "pro_500_month",
					status: "canceled",
				}),
				{ id: "evt_ended" },
			),
		);

		expect(stateEvents.rows[0]).toMatchObject({
			fromLookupKey: "pro_500_month",
			kind: "ended",
			toStatus: "canceled",
		});
	});

	it("links an ended cancellation cycle to the exact persisted state event", async () => {
		const { cancellationReasons, lifecycle } = setupLifecycle();

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.deleted",
				stripeSubscription({ id: "sub_linked", status: "canceled" }),
				{ id: "evt_ended_linked" },
			),
		);

		expect(cancellationReasons.endedLinks).toEqual([
			{
				endedStateEventId: "state_evt_ended_linked",
				stripeSubscriptionId: "sub_linked",
			},
		]);
	});

	it("keeps ended-webhook history non-throwing when cancellation linking fails", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { cancellationReasons, lifecycle, stateEvents } = setupLifecycle();
		cancellationReasons.endLinkError = new Error("reasons table unavailable");

		await expect(
			lifecycle.recordEvent(
				stripeEvent(
					"customer.subscription.deleted",
					stripeSubscription({ id: "sub_best_effort", status: "canceled" }),
					{ id: "evt_ended_best_effort" },
				),
			),
		).resolves.toEqual({ inserted: 1, skipped: 0 });
		expect(stateEvents.rows[0]).toMatchObject({
			kind: "ended",
			stripeEventId: "evt_ended_best_effort",
		});
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("Could not update cancellation-reason lifecycle"),
		);
	});

	it("persists every transition when one update contains several diffs", async () => {
		const { lifecycle, stateEvents } = setupLifecycle();

		await lifecycle.recordEvent(
			stripeEvent(
				"customer.subscription.updated",
				stripeSubscription({
					cancelAtPeriodEnd: true,
					lookupKey: "pro_500_month",
					status: "past_due",
				}),
				{
					id: "evt_combined",
					previousAttributes: {
						cancel_at_period_end: false,
						items: subscriptionItems("pro_250_month"),
						status: "active",
					},
				},
			),
		);

		expect(
			stateEvents.rows.map((row) => [row.kind, row.stripeEventId]),
		).toEqual([
			["plan_changed", "evt_combined"],
			["status_changed", "evt_combined:status_changed"],
			["cancel_scheduled", "evt_combined:cancel_scheduled"],
		]);
	});

	it("is rerun-safe when the backfill feeds the same event twice", async () => {
		const { lifecycle, stateEvents } = setupLifecycle();
		const event = stripeEvent(
			"customer.subscription.created",
			stripeSubscription(),
			{ id: "evt_backfill_duplicate" },
		);

		await expect(lifecycle.recordEvent(event)).resolves.toEqual({
			inserted: 1,
			skipped: 0,
		});
		await expect(lifecycle.recordEvent(event)).resolves.toEqual({
			inserted: 0,
			skipped: 1,
		});
		expect(stateEvents.rows).toHaveLength(1);
	});
});

describe("SubscriptionLifecycleService payment adjustments", () => {
	it("turns cumulative refunds into increments and guards replays and stale events", async () => {
		const { lifecycle, paymentAdjustments } = setupLifecycle();
		const refundEvent = (id: string, cumulative: number) =>
			stripeEvent(
				"charge.refunded",
				{
					amount_refunded: cumulative,
					currency: "USD",
					customer: "cus_1",
					id: "ch_1",
				},
				{ id },
			);

		await lifecycle.recordEvent(refundEvent("evt_refund_300", 300));
		await expect(
			lifecycle.recordEvent(refundEvent("evt_refund_300", 300)),
		).resolves.toEqual({ inserted: 0, skipped: 1 });
		await lifecycle.recordEvent(refundEvent("evt_refund_800", 800));
		await lifecycle.recordEvent(refundEvent("evt_refund_stale", 600));
		await lifecycle.recordEvent(refundEvent("evt_refund_1000", 1_000));

		expect(
			paymentAdjustments.rows.map((row) => ({
				amountCents: row.amountCents,
				cumulativeRefundedCents: row.cumulativeRefundedCents,
				stripeEventId: row.stripeEventId,
			})),
		).toEqual([
			{
				amountCents: 300,
				cumulativeRefundedCents: 300,
				stripeEventId: "evt_refund_300",
			},
			{
				amountCents: 500,
				cumulativeRefundedCents: 800,
				stripeEventId: "evt_refund_800",
			},
			{
				amountCents: 0,
				cumulativeRefundedCents: 600,
				stripeEventId: "evt_refund_stale",
			},
			{
				amountCents: 200,
				cumulativeRefundedCents: 1_000,
				stripeEventId: "evt_refund_1000",
			},
		]);
		expect(paymentAdjustments.lockCalls).toEqual([
			"ch_1",
			"ch_1",
			"ch_1",
			"ch_1",
			"ch_1",
		]);
	});

	it("records a failed payment using amount_due", async () => {
		const { lifecycle, paymentAdjustments } = setupLifecycle();

		await lifecycle.recordEvent(
			stripeEvent(
				"invoice.payment_failed",
				{
					amount_due: 4_250,
					currency: "usd",
					customer: "cus_1",
					id: "in_failed",
				},
				{ id: "evt_failed_payment" },
			),
		);

		expect(paymentAdjustments.rows).toEqual([
			expect.objectContaining({
				amountCents: 4_250,
				cumulativeRefundedCents: null,
				kind: "failed_payment",
				stripeEventId: "evt_failed_payment",
				stripeObjectId: "in_failed",
				userId: "user_1",
			}),
		]);
	});

	it("resolves a failed-payment owner from Stripe v20 invoice parent data", async () => {
		const { lifecycle, paymentAdjustments, subscriptions } = setupLifecycle();
		subscriptions.seed({
			lookupKey: "pro_500_month",
			organizationId: "org_invoice",
			providerSubscriptionId: "sub_invoice",
			userId: "user_invoice_creator",
		});

		await lifecycle.recordEvent(
			stripeEvent(
				"invoice.payment_failed",
				{
					amount_due: 9_000,
					currency: "usd",
					customer: "cus_unknown",
					id: "in_parent",
					parent: {
						subscription_details: { subscription: "sub_invoice" },
						type: "subscription_details",
					},
				},
				{ id: "evt_invoice_parent" },
			),
		);

		expect(paymentAdjustments.rows[0]).toMatchObject({
			organizationId: "org_invoice",
			userId: "user_invoice_creator",
		});
	});
});

describe("StripeEventRouter billing history wiring", () => {
	it.each([
		"customer.subscription.created",
		"customer.subscription.updated",
		"customer.subscription.deleted",
		"invoice.payment_failed",
		"charge.refunded",
	] as const)("records the routed history event %s", async (type) => {
		const lifecycle = { recordEvent: vi.fn(async () => ({ inserted: 1 })) };
		const router = routerWith({ lifecycle });
		const object = type.startsWith("customer.subscription.")
			? stripeSubscription({
					status: type.endsWith("deleted") ? "canceled" : "active",
				})
			: type === "invoice.payment_failed"
				? { amount_due: 100, currency: "usd", customer: "cus_1", id: "in_1" }
				: { amount_refunded: 100, currency: "usd", id: "ch_1" };
		const event = stripeEvent(type, object);

		await expect(router.route(event)).resolves.toBeDefined();
		expect(lifecycle.recordEvent).toHaveBeenCalledWith(event);
	});

	it.each([
		"customer.subscription.paused",
		"invoice.payment_action_required",
	] as const)("does not extend history recording to %s", async (type) => {
		const lifecycle = { recordEvent: vi.fn(async () => ({ inserted: 1 })) };
		const router = routerWith({ lifecycle });
		const object = type.startsWith("customer.subscription.")
			? stripeSubscription()
			: { customer: "cus_1", id: "in_action" };

		await expect(
			router.route(stripeEvent(type, object)),
		).resolves.toBeDefined();
		expect(lifecycle.recordEvent).not.toHaveBeenCalled();
	});

	it("keeps subscription sync working when lifecycle recording fails", async () => {
		const logger = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => {});
		const sync = {
			syncFromStripe: vi.fn(async () => []),
		};
		const lifecycle = {
			recordEvent: vi.fn(async () => {
				throw new Error("history unavailable");
			}),
		};
		const router = routerWith({ lifecycle, sync });
		const event = stripeEvent(
			"customer.subscription.updated",
			stripeSubscription(),
			{ id: "evt_isolated" },
		);

		await expect(router.route(event)).resolves.toEqual({ status: "processed" });
		expect(sync.syncFromStripe).toHaveBeenCalledWith("cus_1");
		expect(lifecycle.recordEvent).toHaveBeenCalledWith(event);
		expect(logger).toHaveBeenCalled();
		logger.mockRestore();
	});

	it("records a charge refund even when existing routing skips it", async () => {
		const lifecycle = { recordEvent: vi.fn(async () => ({ inserted: 1 })) };
		const refunds = { handleChargeRefunded: vi.fn(async () => false) };
		const router = routerWith({ lifecycle, refunds });
		const event = stripeEvent("charge.refunded", {
			amount_refunded: 100,
			currency: "usd",
			id: "ch_skipped",
		});

		await expect(router.route(event)).resolves.toMatchObject({
			status: "skipped",
		});
		expect(lifecycle.recordEvent).toHaveBeenCalledWith(event);
	});
});

function routerWith(input: {
	lifecycle: { recordEvent: (event: Stripe.Event) => Promise<unknown> };
	refunds?: {
		handleChargeRefunded: (charge: Stripe.Charge) => Promise<boolean>;
	};
	sync?: { syncFromStripe: (customerId: string) => Promise<unknown[]> };
}): StripeEventRouter {
	const sync = input.sync ?? { syncFromStripe: vi.fn(async () => []) };
	const refunds = input.refunds ?? {
		handleChargeRefunded: vi.fn(async () => false),
	};

	return new StripeEventRouter(
		{} as BillingCustomersRepository,
		{} as OrganizationBillingCustomersRepository,
		sync as StripeSubscriptionSyncService,
		{
			expireForDeletedSubscription: vi.fn(async () => undefined),
		} as unknown as SubscriptionCreditsService,
		refunds as PaymentRefundsService,
		{} as BillingCheckoutAttemptsRepository,
		undefined,
		undefined,
		undefined,
		input.lifecycle as SubscriptionLifecycleService,
	);
}
