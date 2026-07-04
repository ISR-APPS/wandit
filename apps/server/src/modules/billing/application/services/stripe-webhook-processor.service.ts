import { Inject, Injectable } from "@nestjs/common";
import {
	type ParsedPriceLookupKey,
	parsePriceLookupKey,
	priceLookupKey,
} from "@wandit/contracts";
import type Stripe from "stripe";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { BillingCreditLedgerRepository } from "../../infrastructure/persistence/billing-credit-ledger.repository";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import { BillingWebhookEventsRepository } from "../../infrastructure/persistence/billing-webhook-events.repository";
import {
	type SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import { StripeProvider } from "../../infrastructure/stripe/stripe.provider";

type WebhookOutcome = "processed" | "skipped";

type ParsedInvoiceLine = {
	amount: number;
	lookupKey: string;
	parsed: ParsedPriceLookupKey;
	proration: boolean;
};

@Injectable()
export class StripeWebhookProcessor {
	constructor(
		@Inject(BillingWebhookEventsRepository)
		private readonly billingWebhookEventsRepository: BillingWebhookEventsRepository,
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(BillingCreditLedgerRepository)
		private readonly billingCreditLedgerRepository: BillingCreditLedgerRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(StripeProvider)
		private readonly stripeProvider: StripeProvider,
	) {}

	async process(event: Stripe.Event): Promise<{ received: true }> {
		const inserted =
			await this.billingWebhookEventsRepository.tryInsertReceived(event);

		if (!inserted) {
			const existing = await this.billingWebhookEventsRepository.findById(
				event.id,
			);

			if (existing?.status === "processed" || existing?.status === "skipped") {
				return { received: true };
			}
		}

		try {
			const outcome = await this.handleEvent(event);

			if (outcome === "processed") {
				await this.billingWebhookEventsRepository.markProcessed(event.id);
			} else {
				await this.billingWebhookEventsRepository.markSkipped(event.id);
			}
		} catch (error) {
			await this.billingWebhookEventsRepository.markFailed(
				event.id,
				this.errorMessage(error),
			);

			throw error;
		}

		return { received: true };
	}

	private handleEvent(event: Stripe.Event): Promise<WebhookOutcome> {
		switch (event.type) {
			case "checkout.session.completed":
				return this.handleCheckoutSessionCompleted(event.data.object);
			case "customer.subscription.created":
			case "customer.subscription.updated":
				return this.handleSubscriptionUpsert(event.data.object);
			case "customer.subscription.deleted":
				return this.handleSubscriptionDeleted(event.data.object);
			case "invoice.paid":
				return this.handleInvoicePaid(event.data.object);
			case "invoice.payment_failed":
				return this.handleInvoicePaymentFailed(event.data.object);
			case "charge.refunded":
				return this.handleChargeRefunded(event.data.object);
			case "charge.dispute.created":
				return this.handleChargeDisputeCreated(event.data.object);
			default:
				return Promise.resolve("skipped");
		}
	}

	private async handleCheckoutSessionCompleted(
		session: Stripe.Checkout.Session,
	): Promise<WebhookOutcome> {
		if (session.mode === "payment") {
			const userId = this.requiredMetadata(session.metadata, "userId");
			const packId = this.requiredMetadata(session.metadata, "packId");
			const credits = this.positiveIntegerMetadata(session.metadata, "credits");
			const paymentIntentId = this.expandableId(session.payment_intent);

			await this.creditsService.topup(userId, credits, {
				idempotencyKey: `topup:${session.id}`,
				meta: this.withPaymentIntent(
					{
						packId,
						reason: "topup_purchase",
						sessionId: session.id,
					},
					paymentIntentId,
				),
			});

			return "processed";
		}

		if (session.mode === "subscription") {
			const userId = session.client_reference_id ?? session.metadata?.userId;
			const providerCustomerId = this.expandableId(session.customer);

			if (!userId || !providerCustomerId) {
				return "skipped";
			}

			await this.billingCustomersRepository.upsertByUserId({
				provider: "stripe",
				providerCustomerId,
				userId,
			});

			return "processed";
		}

		return "skipped";
	}

	private async handleSubscriptionUpsert(
		subscription: Stripe.Subscription,
	): Promise<WebhookOutcome> {
		const row = await this.upsertSubscriptionMirror(subscription);

		return row ? "processed" : "skipped";
	}

	private async handleSubscriptionDeleted(
		subscription: Stripe.Subscription,
	): Promise<WebhookOutcome> {
		const row =
			(await this.upsertSubscriptionMirror(subscription)) ??
			(await this.subscriptionsRepository.updateStatus(
				subscription.id,
				"canceled",
			));

		if (!row) {
			return "skipped";
		}

		await this.creditsService.expirePlanRemainder(row.userId, {
			idempotencyKey: `subdel:${subscription.id}`,
			meta: {
				providerSubscriptionId: subscription.id,
				reason: "subscription_ended",
			},
		});

		return "processed";
	}

	private async handleInvoicePaid(
		eventInvoice: Stripe.Invoice,
	): Promise<WebhookOutcome> {
		const invoice = await this.stripeProvider.retrieveInvoice(eventInvoice.id);

		switch (invoice.billing_reason) {
			case "subscription_create":
				return this.handleInitialSubscriptionInvoice(invoice);
			case "subscription_cycle":
				return this.handleSubscriptionCycleInvoice(invoice);
			case "subscription_update":
				return this.handleSubscriptionUpdateInvoice(invoice);
			default:
				return "skipped";
		}
	}

	private async handleInitialSubscriptionInvoice(
		invoice: Stripe.Invoice,
	): Promise<WebhookOutcome> {
		const currentPlan = await this.currentPlanFromInvoice(invoice);

		if (!currentPlan) {
			return "skipped";
		}

		const userId = await this.requiredUserIdForInvoice(invoice);
		const paymentIntentId = this.paymentIntentIdFromInvoice(invoice);

		await this.creditsService.grant(userId, this.allotment(currentPlan), {
			bucket: "plan",
			idempotencyKey: `inv:${invoice.id}:grant`,
			meta: this.withPaymentIntent(
				{
					invoiceId: invoice.id,
					reason: "subscription_initial",
				},
				paymentIntentId,
			),
		});

		return "processed";
	}

	private async handleSubscriptionCycleInvoice(
		invoice: Stripe.Invoice,
	): Promise<WebhookOutcome> {
		const currentPlan = await this.currentPlanFromInvoice(invoice);

		if (!currentPlan) {
			return "skipped";
		}

		const userId = await this.requiredUserIdForInvoice(invoice);
		const paymentIntentId = this.paymentIntentIdFromInvoice(invoice);

		await this.creditsService.expirePlanRemainder(userId, {
			idempotencyKey: `inv:${invoice.id}:expire`,
			meta: {
				invoiceId: invoice.id,
				reason: "subscription_cycle_expire",
			},
		});
		await this.creditsService.grant(userId, this.allotment(currentPlan), {
			bucket: "plan",
			idempotencyKey: `inv:${invoice.id}:grant`,
			meta: this.withPaymentIntent(
				{
					invoiceId: invoice.id,
					reason: "subscription_cycle",
				},
				paymentIntentId,
			),
		});

		return "processed";
	}

	private async handleSubscriptionUpdateInvoice(
		invoice: Stripe.Invoice,
	): Promise<WebhookOutcome> {
		const currentPlan = await this.currentPlanFromInvoice(invoice);

		if (!currentPlan) {
			return "skipped";
		}

		const userId = await this.requiredUserIdForInvoice(invoice);
		const paymentIntentId = this.paymentIntentIdFromInvoice(invoice);
		const { newPlan, oldPlan } = await this.subscriptionUpdatePlans(
			invoice,
			currentPlan,
		);

		if (
			oldPlan &&
			newPlan &&
			oldPlan.parsed.interval === newPlan.parsed.interval
		) {
			const delta =
				this.allotment(newPlan.parsed) - this.allotment(oldPlan.parsed);

			if (delta > 0) {
				await this.creditsService.grant(userId, delta, {
					bucket: "plan",
					idempotencyKey: `inv:${invoice.id}:grant`,
					meta: this.withPaymentIntent(
						{
							invoiceId: invoice.id,
							newPriceLookupKey: newPlan.lookupKey,
							oldPriceLookupKey: oldPlan.lookupKey,
							reason: "subscription_update",
						},
						paymentIntentId,
					),
				});
			} else if (delta < 0) {
				await this.creditsService.expireAmount(userId, Math.abs(delta), {
					idempotencyKey: `inv:${invoice.id}:expire`,
					meta: {
						invoiceId: invoice.id,
						newPriceLookupKey: newPlan.lookupKey,
						oldPriceLookupKey: oldPlan.lookupKey,
						reason: "subscription_update",
					},
				});
			}

			return "processed";
		}

		await this.creditsService.expirePlanRemainder(userId, {
			idempotencyKey: `inv:${invoice.id}:expire`,
			meta: {
				invoiceId: invoice.id,
				reason: "subscription_update_interval_change",
			},
		});
		await this.creditsService.grant(userId, this.allotment(newPlan.parsed), {
			bucket: "plan",
			idempotencyKey: `inv:${invoice.id}:grant`,
			meta: this.withPaymentIntent(
				{
					invoiceId: invoice.id,
					reason: "subscription_update_full_grant",
				},
				paymentIntentId,
			),
		});

		return "processed";
	}

	private async handleInvoicePaymentFailed(
		eventInvoice: Stripe.Invoice,
	): Promise<WebhookOutcome> {
		const invoice = await this.stripeProvider.retrieveInvoice(eventInvoice.id);
		const providerSubscriptionId = this.subscriptionIdFromInvoice(invoice);

		if (!providerSubscriptionId) {
			return "skipped";
		}

		let subscription: Stripe.Subscription | null = null;

		try {
			subscription = await this.stripeProvider.retrieveSubscription(
				providerSubscriptionId,
			);
		} catch {
			const row = await this.subscriptionsRepository.updateStatus(
				providerSubscriptionId,
				"past_due",
			);

			return row ? "processed" : "skipped";
		}

		const row = await this.upsertSubscriptionMirror(subscription);

		return row ? "processed" : "skipped";
	}

	private async handleChargeRefunded(
		charge: Stripe.Charge,
	): Promise<WebhookOutcome> {
		const paymentIntentId = this.expandableId(charge.payment_intent);

		if (!paymentIntentId) {
			return "skipped";
		}

		return this.revokePurchasedCredits(paymentIntentId, {
			chargeId: charge.id,
			idempotencyKey: `refund:${charge.id}`,
			reason: "charge_refunded",
		});
	}

	private async handleChargeDisputeCreated(
		dispute: Stripe.Dispute,
	): Promise<WebhookOutcome> {
		const paymentIntentId = this.expandableId(dispute.payment_intent);

		if (!paymentIntentId) {
			return "skipped";
		}

		return this.revokePurchasedCredits(paymentIntentId, {
			chargeId: this.expandableId(dispute.charge),
			disputeId: dispute.id,
			idempotencyKey: `dispute:${dispute.id}`,
			reason: "charge_dispute_created",
		});
	}

	private async revokePurchasedCredits(
		paymentIntentId: string,
		input: {
			chargeId: string | null;
			disputeId?: string;
			idempotencyKey: string;
			reason: string;
		},
	): Promise<WebhookOutcome> {
		const rows =
			await this.billingCreditLedgerRepository.findPositiveRowsByPaymentIntentId(
				paymentIntentId,
			);

		if (rows.length === 0) {
			return "skipped";
		}

		const [firstRow] = rows;
		const amount = rows.reduce((sum, row) => sum + row.delta, 0);

		if (!firstRow || amount <= 0) {
			return "skipped";
		}

		await this.creditsService.revoke(firstRow.userId, amount, {
			idempotencyKey: input.idempotencyKey,
			meta: {
				...(input.chargeId ? { chargeId: input.chargeId } : {}),
				...(input.disputeId ? { disputeId: input.disputeId } : {}),
				paymentIntentId,
				reason: input.reason,
			},
		});

		return "processed";
	}

	private async upsertSubscriptionMirror(
		subscription: Stripe.Subscription,
	): Promise<SubscriptionRow | null> {
		const plan = await this.planFromSubscription(subscription);

		if (!plan) {
			return null;
		}

		const userId = await this.userIdForSubscription(subscription);

		if (!userId) {
			return null;
		}

		return this.subscriptionsRepository.upsertByProviderSubscriptionId({
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			currentPeriodEnd: this.dateFromSeconds(plan.item.current_period_end),
			currentPeriodStart: this.dateFromSeconds(plan.item.current_period_start),
			interval: plan.parsed.interval,
			organizationId: null,
			plan: plan.parsed.plan,
			priceLookupKey: plan.lookupKey,
			provider: "stripe",
			providerSubscriptionId: subscription.id,
			status: subscription.status,
			tierCredits: plan.parsed.tierCredits,
			userId,
		});
	}

	private async userIdForSubscription(
		subscription: Stripe.Subscription,
	): Promise<string | null> {
		const metadataUserId = subscription.metadata.userId;

		if (metadataUserId) {
			return metadataUserId;
		}

		const existing =
			await this.subscriptionsRepository.findByProviderSubscriptionId(
				subscription.id,
			);

		if (existing) {
			return existing.userId;
		}

		const customerId = this.expandableId(subscription.customer);

		if (!customerId) {
			return null;
		}

		const customer =
			await this.billingCustomersRepository.findByProviderCustomerId(
				customerId,
			);

		return customer?.userId ?? null;
	}

	private async requiredUserIdForInvoice(invoice: Stripe.Invoice) {
		const userId = await this.userIdForInvoice(invoice);

		if (!userId) {
			throw new Error(
				`Could not resolve user for Stripe invoice ${invoice.id}`,
			);
		}

		return userId;
	}

	private async userIdForInvoice(
		invoice: Stripe.Invoice,
	): Promise<string | null> {
		const metadataUserId =
			invoice.parent?.subscription_details?.metadata?.userId ??
			this.expandedSubscriptionFromInvoice(invoice)?.metadata.userId;

		if (metadataUserId) {
			return metadataUserId;
		}

		const providerSubscriptionId = this.subscriptionIdFromInvoice(invoice);

		if (providerSubscriptionId) {
			const subscription =
				await this.subscriptionsRepository.findByProviderSubscriptionId(
					providerSubscriptionId,
				);

			if (subscription) {
				return subscription.userId;
			}
		}

		const customerId = this.expandableId(invoice.customer);

		if (!customerId) {
			return null;
		}

		const customer =
			await this.billingCustomersRepository.findByProviderCustomerId(
				customerId,
			);

		return customer?.userId ?? null;
	}

	private async currentPlanFromInvoice(
		invoice: Stripe.Invoice,
	): Promise<ParsedPriceLookupKey | null> {
		const lines = await this.parsedInvoiceLines(invoice);
		const currentLine = lines.find((line) => !line.proration);

		if (currentLine) {
			return currentLine.parsed;
		}

		const subscription = this.expandedSubscriptionFromInvoice(invoice);

		if (subscription) {
			return (await this.planFromSubscription(subscription))?.parsed ?? null;
		}

		const providerSubscriptionId = this.subscriptionIdFromInvoice(invoice);

		if (!providerSubscriptionId) {
			return null;
		}

		const retrievedSubscription =
			await this.stripeProvider.retrieveSubscription(providerSubscriptionId);

		return (
			(await this.planFromSubscription(retrievedSubscription))?.parsed ?? null
		);
	}

	private async subscriptionUpdatePlans(
		invoice: Stripe.Invoice,
		newPlan: ParsedPriceLookupKey,
	) {
		const lines = await this.parsedInvoiceLines(invoice);
		const confirmedNewPlanLookupKey =
			lines.find(
				(line) =>
					line.proration &&
					line.amount > 0 &&
					this.samePlan(line.parsed, newPlan),
			)?.lookupKey ?? this.lookupKeyForParsedPlan(newPlan);
		const currentPlan = {
			lookupKey: confirmedNewPlanLookupKey,
			parsed: newPlan,
		};
		const oldPlan =
			lines.find(
				(line) =>
					line.proration &&
					line.amount < 0 &&
					line.lookupKey !== currentPlan.lookupKey,
			) ??
			lines.find(
				(line) => line.proration && line.lookupKey !== currentPlan.lookupKey,
			) ??
			null;

		return {
			newPlan: currentPlan,
			oldPlan,
		};
	}

	private async parsedInvoiceLines(
		invoice: Stripe.Invoice,
	): Promise<ParsedInvoiceLine[]> {
		const parsedLines: ParsedInvoiceLine[] = [];

		for (const line of invoice.lines.data) {
			const lookupKey = await this.lookupKeyForInvoiceLine(line);

			if (!lookupKey) {
				continue;
			}

			const parsed = parsePriceLookupKey(lookupKey);

			if (!parsed) {
				continue;
			}

			parsedLines.push({
				amount: line.amount,
				lookupKey,
				parsed,
				proration: this.isProrationLine(line),
			});
		}

		return parsedLines;
	}

	private async planFromSubscription(subscription: Stripe.Subscription) {
		const [item] = subscription.items.data;

		if (!item) {
			return null;
		}

		const lookupKey =
			item.price.lookup_key ??
			(await this.stripeProvider.lookupKeyForPriceId(item.price.id));

		if (!lookupKey) {
			return null;
		}

		const parsed = parsePriceLookupKey(lookupKey);

		if (!parsed) {
			return null;
		}

		return {
			item,
			lookupKey,
			parsed,
		};
	}

	private async lookupKeyForInvoiceLine(
		line: Stripe.InvoiceLineItem,
	): Promise<string | null> {
		const price = line.pricing?.price_details?.price;

		if (!price) {
			return null;
		}

		if (typeof price === "string") {
			return this.stripeProvider.lookupKeyForPriceId(price);
		}

		return price.lookup_key;
	}

	private isProrationLine(line: Stripe.InvoiceLineItem) {
		if (!line.parent) {
			return false;
		}

		if (line.parent.type === "subscription_item_details") {
			return line.parent.subscription_item_details?.proration ?? false;
		}

		return line.parent.invoice_item_details?.proration ?? false;
	}

	private expandedSubscriptionFromInvoice(
		invoice: Stripe.Invoice,
	): Stripe.Subscription | null {
		const subscription = invoice.parent?.subscription_details?.subscription;

		if (
			typeof subscription === "object" &&
			subscription.object === "subscription"
		) {
			return subscription;
		}

		return null;
	}

	private subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
		return this.expandableId(
			invoice.parent?.subscription_details?.subscription,
		);
	}

	private paymentIntentIdFromInvoice(invoice: Stripe.Invoice): string | null {
		for (const payment of invoice.payments?.data ?? []) {
			const paymentIntentId = this.expandableId(payment.payment.payment_intent);

			if (paymentIntentId) {
				return paymentIntentId;
			}
		}

		return null;
	}

	private requiredMetadata(
		metadata: Stripe.Metadata | null,
		key: string,
	): string {
		const value = metadata?.[key];

		if (!value) {
			throw new Error(`Stripe metadata ${key} is required`);
		}

		return value;
	}

	private positiveIntegerMetadata(
		metadata: Stripe.Metadata | null,
		key: string,
	): number {
		const value = Number(this.requiredMetadata(metadata, key));

		if (!Number.isInteger(value) || value <= 0) {
			throw new Error(`Stripe metadata ${key} must be a positive integer`);
		}

		return value;
	}

	private expandableId(
		value: string | { id: string } | null | undefined,
	): string | null {
		if (!value) {
			return null;
		}

		return typeof value === "string" ? value : value.id;
	}

	private allotment(parsed: ParsedPriceLookupKey) {
		return parsed.tierCredits * (parsed.interval === "year" ? 12 : 1);
	}

	private lookupKeyForParsedPlan(parsed: ParsedPriceLookupKey) {
		return priceLookupKey(parsed.plan, parsed.tierCredits, parsed.interval);
	}

	private samePlan(left: ParsedPriceLookupKey, right: ParsedPriceLookupKey) {
		return (
			left.interval === right.interval &&
			left.plan === right.plan &&
			left.tierCredits === right.tierCredits
		);
	}

	private dateFromSeconds(seconds: number) {
		return new Date(seconds * 1000);
	}

	private withPaymentIntent(
		meta: Record<string, unknown>,
		paymentIntentId: string | null,
	) {
		return paymentIntentId ? { ...meta, paymentIntentId } : meta;
	}

	private errorMessage(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}
}
