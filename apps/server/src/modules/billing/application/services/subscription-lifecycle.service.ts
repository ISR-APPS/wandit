import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { parsePriceLookupKey } from "@wandit/contracts";
import type Stripe from "stripe";

import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import { BillingPaymentAdjustmentsRepository } from "../../infrastructure/persistence/billing-payment-adjustments.repository";
import { CancellationReasonsRepository } from "../../infrastructure/persistence/cancellation-reasons.repository";
import { OrganizationBillingCustomersRepository } from "../../infrastructure/persistence/organization-billing-customers.repository";
import {
	type InsertSubscriptionStateEvent,
	SubscriptionStateEventsRepository,
} from "../../infrastructure/persistence/subscription-state-events.repository";
import {
	type SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";

export type BillingHistoryRecordResult = {
	inserted: number;
	skipped: number;
};

type BillingHistoryOwner = {
	organizationId: string | null;
	userId: string | null;
};

export type SubscriptionDerivationContext = BillingHistoryOwner;

const EMPTY_OWNER: BillingHistoryOwner = {
	organizationId: null,
	userId: null,
};

const SUBSCRIPTION_EVENT_TYPES = [
	"customer.subscription.created",
	"customer.subscription.updated",
	"customer.subscription.deleted",
] as const;

type SubscriptionEventType = (typeof SUBSCRIPTION_EVENT_TYPES)[number];

/**
 * Derives append-only billing history exclusively from the stored Stripe event;
 * the supplied context carries only best-effort owner identity. It performs no
 * network or database work and is shared by live delivery and the backfill.
 */
export function deriveSubscriptionStateEvents(
	event: Stripe.Event,
	context: SubscriptionDerivationContext,
): InsertSubscriptionStateEvent[] {
	if (!isSubscriptionEventType(event.type)) {
		return [];
	}

	const subscription = event.data.object as Stripe.Subscription;
	const occurredAt = new Date(event.created * 1000);
	const currentLookupKey = lookupKeyFromSubscription(subscription);
	const common = {
		occurredAt,
		organizationId: context.organizationId,
		stripeSubscriptionId: subscription.id,
		userId: context.userId,
	};

	if (event.type === "customer.subscription.created") {
		return [
			{
				...common,
				kind: "created",
				stripeEventId: event.id,
				toLookupKey: currentLookupKey,
				toStatus: subscription.status,
			},
		];
	}

	if (event.type === "customer.subscription.deleted") {
		return [
			{
				...common,
				fromLookupKey: currentLookupKey,
				kind: "ended",
				stripeEventId: event.id,
				toStatus: subscription.status,
			},
		];
	}

	const previous = previousAttributes(event);
	const derived: InsertSubscriptionStateEvent[] = [];

	if (hasOwn(previous, "items") || hasOwn(previous, "price")) {
		const previousLookupKey =
			lookupKeyFromItems(previous.items) ?? lookupKeyFromPrice(previous.price);

		derived.push({
			...common,
			fromLookupKey: previousLookupKey,
			kind: "plan_changed",
			stripeEventId: event.id,
			toLookupKey: currentLookupKey,
		});
	}

	if (hasOwn(previous, "status") && typeof previous.status === "string") {
		derived.push({
			...common,
			fromStatus: previous.status,
			kind: "status_changed",
			stripeEventId: event.id,
			toStatus: subscription.status,
		});
	}

	if (
		hasOwn(previous, "cancel_at_period_end") &&
		typeof previous.cancel_at_period_end === "boolean" &&
		previous.cancel_at_period_end !== subscription.cancel_at_period_end
	) {
		derived.push({
			...common,
			kind: subscription.cancel_at_period_end
				? "cancel_scheduled"
				: "cancel_unscheduled",
			stripeEventId: event.id,
		});
	}

	return withStableDerivedEventIds(derived, event.id);
}

@Injectable()
export class SubscriptionLifecycleService {
	private readonly logger = new Logger(SubscriptionLifecycleService.name);

	constructor(
		@Inject(SubscriptionStateEventsRepository)
		private readonly stateEventsRepository: SubscriptionStateEventsRepository,
		@Inject(BillingPaymentAdjustmentsRepository)
		private readonly paymentAdjustmentsRepository: BillingPaymentAdjustmentsRepository,
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(OrganizationBillingCustomersRepository)
		private readonly organizationBillingCustomersRepository: OrganizationBillingCustomersRepository,
		@Optional()
		@Inject(CancellationReasonsRepository)
		private readonly cancellationReasonsRepository?: CancellationReasonsRepository,
	) {}

	async recordEvent(event: Stripe.Event): Promise<BillingHistoryRecordResult> {
		switch (event.type) {
			case "customer.subscription.created":
			case "customer.subscription.updated":
			case "customer.subscription.deleted":
				return this.recordSubscriptionEvent(event);
			case "charge.refunded":
				return this.recordRefund(event);
			case "invoice.payment_failed":
				return this.recordFailedPayment(event);
			default:
				return { inserted: 0, skipped: 1 };
		}
	}

	private async recordSubscriptionEvent(
		event: Stripe.Event,
	): Promise<BillingHistoryRecordResult> {
		const subscription = event.data.object as Stripe.Subscription;
		const owner = await this.resolveSubscriptionOwner(subscription);
		const rows = deriveSubscriptionStateEvents(event, owner);

		if (rows.length === 0) {
			return { inserted: 0, skipped: 1 };
		}

		let inserted = 0;

		for (const row of rows) {
			if (await this.stateEventsRepository.tryInsert(row)) {
				inserted += 1;
			}

			await this.updateCancellationReasonLifecycle(row);
		}

		return { inserted, skipped: rows.length - inserted };
	}

	private async updateCancellationReasonLifecycle(
		row: InsertSubscriptionStateEvent,
	): Promise<void> {
		if (row.kind !== "cancel_unscheduled" && row.kind !== "ended") {
			return;
		}

		try {
			if (row.kind === "cancel_unscheduled") {
				await this.cancellationReasonsRepository?.markNewestScheduledResumed(
					row.stripeSubscriptionId,
				);
				return;
			}

			const endedStateEvent =
				await this.stateEventsRepository.findByStripeEventId(row.stripeEventId);

			if (endedStateEvent) {
				await this.cancellationReasonsRepository?.linkNewestOpenToEnded(
					row.stripeSubscriptionId,
					endedStateEvent.id,
				);
			}
		} catch (error) {
			this.logger.warn(
				`Could not update cancellation-reason lifecycle for Stripe subscription ${row.stripeSubscriptionId}: ${errorMessage(error)}`,
			);
		}
	}

	private async recordRefund(
		event: Stripe.Event,
	): Promise<BillingHistoryRecordResult> {
		const charge = event.data.object as Stripe.Charge;
		const cumulativeRefundedCents = nonNegativeInteger(charge.amount_refunded);
		const currency = normalizedCurrency(charge.currency);

		if (!charge.id || cumulativeRefundedCents === null || !currency) {
			return { inserted: 0, skipped: 1 };
		}

		const owner = await this.resolveOwner({
			providerCustomerId: expandableId(charge.customer),
		});

		return this.paymentAdjustmentsRepository.withStripeObjectLock(
			charge.id,
			async (tx) => {
				const priorRefundedCents =
					await this.paymentAdjustmentsRepository.sumRefundIncrementsByStripeObjectId(
						charge.id,
						tx,
					);
				const amountCents = Math.max(
					0,
					cumulativeRefundedCents - priorRefundedCents,
				);
				const inserted = await this.paymentAdjustmentsRepository.tryInsert(
					{
						amountCents,
						cumulativeRefundedCents,
						currency,
						kind: "refund",
						occurredAt: new Date(event.created * 1000),
						organizationId: owner.organizationId,
						stripeEventId: event.id,
						stripeObjectId: charge.id,
						userId: owner.userId,
					},
					tx,
				);

				return inserted
					? { inserted: 1, skipped: 0 }
					: { inserted: 0, skipped: 1 };
			},
		);
	}

	private async recordFailedPayment(
		event: Stripe.Event,
	): Promise<BillingHistoryRecordResult> {
		const invoice = event.data.object as Stripe.Invoice;
		const amountCents = nonNegativeInteger(invoice.amount_due);
		const currency = normalizedCurrency(invoice.currency);

		if (!invoice.id || amountCents === null || !currency) {
			return { inserted: 0, skipped: 1 };
		}

		const owner = await this.resolveOwner({
			providerCustomerId: expandableId(invoice.customer),
			stripeSubscriptionId: subscriptionIdFromInvoice(invoice),
		});
		const inserted = await this.paymentAdjustmentsRepository.tryInsert({
			amountCents,
			cumulativeRefundedCents: null,
			currency,
			kind: "failed_payment",
			occurredAt: new Date(event.created * 1000),
			organizationId: owner.organizationId,
			stripeEventId: event.id,
			stripeObjectId: invoice.id,
			userId: owner.userId,
		});

		return inserted ? { inserted: 1, skipped: 0 } : { inserted: 0, skipped: 1 };
	}

	private async resolveSubscriptionOwner(
		subscription: Stripe.Subscription,
	): Promise<BillingHistoryOwner> {
		const existingSubscription = await this.findSubscription(subscription.id);

		return existingSubscription
			? ownerFromSubscription(existingSubscription)
			: await this.resolveOwner({
					providerCustomerId: expandableId(subscription.customer),
				});
	}

	private async resolveOwner(input: {
		providerCustomerId: string | null;
		stripeSubscriptionId?: string | null;
	}): Promise<BillingHistoryOwner> {
		if (input.stripeSubscriptionId) {
			const subscription = await this.findSubscription(
				input.stripeSubscriptionId,
			);

			if (subscription) {
				return ownerFromSubscription(subscription);
			}
		}

		if (!input.providerCustomerId) {
			return EMPTY_OWNER;
		}

		try {
			const customer =
				await this.billingCustomersRepository.findByProviderCustomerId(
					input.providerCustomerId,
				);

			if (customer) {
				return { organizationId: null, userId: customer.userId };
			}
		} catch (error) {
			this.logOwnerResolutionFailure(input.providerCustomerId, error);
		}

		try {
			const customer =
				await this.organizationBillingCustomersRepository.findByProviderCustomerId(
					input.providerCustomerId,
				);

			if (customer) {
				return {
					organizationId: customer.organizationId,
					userId: customer.createdByUserId,
				};
			}
		} catch (error) {
			this.logOwnerResolutionFailure(input.providerCustomerId, error);
		}

		return EMPTY_OWNER;
	}

	private async findSubscription(
		stripeSubscriptionId: string,
	): Promise<SubscriptionRow | null> {
		try {
			return await this.subscriptionsRepository.findByProviderSubscriptionId(
				stripeSubscriptionId,
			);
		} catch (error) {
			this.logOwnerResolutionFailure(stripeSubscriptionId, error);
			return null;
		}
	}

	private logOwnerResolutionFailure(reference: string, error: unknown): void {
		this.logger.warn(
			`Could not resolve billing-history owner for ${reference}: ${errorMessage(error)}`,
		);
	}
}

function ownerFromSubscription(
	subscription: SubscriptionRow,
): BillingHistoryOwner {
	return {
		organizationId: subscription.organizationId,
		userId: subscription.userId,
	};
}

function previousAttributes(event: Stripe.Event): Record<string, unknown> {
	const data = event.data as Stripe.Event.Data & {
		previous_attributes?: unknown;
	};

	return isRecord(data.previous_attributes) ? data.previous_attributes : {};
}

function lookupKeyFromSubscription(
	subscription: Stripe.Subscription,
): string | null {
	return (
		lookupKeyFromItems(subscription.items) ??
		lookupKeyFromPrice(
			(subscription as unknown as Record<string, unknown>).price,
		)
	);
}

function lookupKeyFromItems(value: unknown): string | null {
	if (!isRecord(value) || !Array.isArray(value.data)) {
		return null;
	}

	const first = value.data[0];

	return isRecord(first) ? lookupKeyFromPrice(first.price) : null;
}

function lookupKeyFromPrice(value: unknown): string | null {
	return isRecord(value) ? recognizedLookupKey(value.lookup_key) : null;
}

function recognizedLookupKey(value: unknown): string | null {
	return typeof value === "string" && parsePriceLookupKey(value) ? value : null;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
	const legacySubscription = (invoice as unknown as Record<string, unknown>)
		.subscription;
	const directId = expandableId(legacySubscription);

	if (directId) {
		return directId;
	}

	const parent = isRecord(invoice.parent) ? invoice.parent : null;
	const details =
		parent && isRecord(parent.subscription_details)
			? parent.subscription_details
			: null;

	return details ? expandableId(details.subscription) : null;
}

function expandableId(value: unknown): string | null {
	if (typeof value === "string" && value.length > 0) {
		return value;
	}

	if (isRecord(value) && typeof value.id === "string" && value.id.length > 0) {
		return value.id;
	}

	return null;
}

function normalizedCurrency(value: unknown): string | null {
	return typeof value === "string" && value.length > 0
		? value.toLowerCase()
		: null;
}

function nonNegativeInteger(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) && value >= 0
		? value
		: null;
}

function hasOwn(
	value: Record<string, unknown>,
	key: string,
): value is Record<string, unknown> {
	return Object.hasOwn(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isSubscriptionEventType(type: string): type is SubscriptionEventType {
	return (SUBSCRIPTION_EVENT_TYPES as readonly string[]).includes(type);
}

function withStableDerivedEventIds(
	rows: InsertSubscriptionStateEvent[],
	stripeEventId: string,
): InsertSubscriptionStateEvent[] {
	if (rows.length < 2) {
		return rows;
	}

	/*
	 * Run 1 made stripe_event_id globally unique even though one Stripe update
	 * can change plan, status, and cancellation state together. Keep the first
	 * row's exact event id and give later derived rows stable, event-scoped keys
	 * so no lifecycle transition is silently discarded and replays remain safe.
	 */
	return rows.map((row, index) => ({
		...row,
		stripeEventId: index === 0 ? stripeEventId : `${stripeEventId}:${row.kind}`,
	}));
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
