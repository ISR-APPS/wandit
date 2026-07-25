import { Inject, Injectable } from "@nestjs/common";
import {
	type ParsedPriceLookupKey,
	parsePriceLookupKey,
	priceLookupKey,
} from "@wandit/contracts";
import type Stripe from "stripe";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";
import { StripeProvider } from "../../infrastructure/stripe/stripe.provider";
import { PaymentRefundsService } from "./payment-refunds.service";

type ParsedInvoiceLine = {
	amount: number;
	lookupKey: string;
	parsed: ParsedPriceLookupKey;
	proration: boolean;
};

type PaymentReferences = {
	chargeId: string | null;
	paymentIntentId: string | null;
};

@Injectable()
export class SubscriptionCreditsService {
	constructor(
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(StripeProvider)
		private readonly stripeProvider: StripeProvider,
		@Inject(PaymentRefundsService)
		private readonly paymentRefundsService: PaymentRefundsService,
	) {}

	async grantTopup(session: Stripe.Checkout.Session): Promise<void> {
		if (session.payment_status !== "paid") {
			throw new Error(`Stripe checkout session ${session.id} is not paid`);
		}

		const userId = this.requiredMetadata(session.metadata, "userId");
		const packId = this.requiredMetadata(session.metadata, "packId");
		const credits = this.positiveIntegerMetadata(session.metadata, "credits");
		const paymentReferences = await this.paymentReferences(
			session.payment_intent,
		);

		await this.creditsService.topup(userId, credits, {
			idempotencyKey: `topup:${session.id}`,
			meta: this.withPaymentReferences(
				{
					packId,
					reason: "topup_purchase",
					sessionId: session.id,
				},
				paymentReferences,
			),
		});
		await this.reconcileFinancialAdjustments(paymentReferences);
	}

	async expireForDeletedSubscription(
		subscription: Stripe.Subscription,
	): Promise<void> {
		const userId = await this.requiredUserIdForSubscription(subscription);

		await this.creditsService.expirePlanRemainder(userId, {
			idempotencyKey: `subdel:${subscription.id}`,
			meta: {
				providerSubscriptionId: subscription.id,
				reason: "subscription_ended",
			},
		});
	}

	async grantForPaidInvoice(eventInvoice: Stripe.Invoice): Promise<boolean> {
		const invoice = await this.stripeProvider.retrieveInvoice(eventInvoice.id);

		switch (invoice.billing_reason) {
			case "subscription_create":
				return this.handleInitialSubscriptionInvoice(invoice);
			case "subscription_cycle":
				return this.handleSubscriptionCycleInvoice(invoice);
			case "subscription_update":
				return this.handleSubscriptionUpdateInvoice(invoice);
			default:
				return false;
		}
	}

	private async handleInitialSubscriptionInvoice(
		invoice: Stripe.Invoice,
	): Promise<boolean> {
		const currentPlan = await this.currentPlanFromInvoice(invoice);

		if (!currentPlan) {
			return false;
		}

		const userId = await this.requiredUserIdForInvoice(invoice);
		const paymentReferences = await this.paymentReferencesFromInvoice(invoice);

		await this.creditsService.grant(userId, this.allotment(currentPlan), {
			bucket: "plan",
			idempotencyKey: `inv:${invoice.id}:grant`,
			meta: this.withPaymentReferences(
				{
					invoiceId: invoice.id,
					reason: "subscription_initial",
				},
				paymentReferences,
			),
		});
		await this.reconcileFinancialAdjustments(paymentReferences);

		return true;
	}

	private async handleSubscriptionCycleInvoice(
		invoice: Stripe.Invoice,
	): Promise<boolean> {
		const currentPlan = await this.currentPlanFromInvoice(invoice);

		if (!currentPlan) {
			return false;
		}

		const userId = await this.requiredUserIdForInvoice(invoice);
		const paymentReferences = await this.paymentReferencesFromInvoice(invoice);

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
			meta: this.withPaymentReferences(
				{
					invoiceId: invoice.id,
					reason: "subscription_cycle",
				},
				paymentReferences,
			),
		});
		await this.reconcileFinancialAdjustments(paymentReferences);

		return true;
	}

	private async handleSubscriptionUpdateInvoice(
		invoice: Stripe.Invoice,
	): Promise<boolean> {
		const currentPlan = await this.currentPlanFromInvoice(invoice);

		if (!currentPlan) {
			return false;
		}

		const userId = await this.requiredUserIdForInvoice(invoice);
		const paymentReferences = await this.paymentReferencesFromInvoice(invoice);
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
					meta: this.withPaymentReferences(
						{
							invoiceId: invoice.id,
							newPriceLookupKey: newPlan.lookupKey,
							oldPriceLookupKey: oldPlan.lookupKey,
							reason: "subscription_update",
						},
						paymentReferences,
					),
				});
				await this.reconcileFinancialAdjustments(paymentReferences);
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

			return true;
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
			meta: this.withPaymentReferences(
				{
					invoiceId: invoice.id,
					reason: "subscription_update_full_grant",
				},
				paymentReferences,
			),
		});
		await this.reconcileFinancialAdjustments(paymentReferences);

		return true;
	}

	private async requiredUserIdForSubscription(
		subscription: Stripe.Subscription,
	): Promise<string> {
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

		if (customerId) {
			const customer =
				await this.billingCustomersRepository.findByProviderCustomerId(
					customerId,
				);

			if (customer) {
				return customer.userId;
			}
		}

		throw new Error(
			`Could not resolve user for Stripe subscription ${subscription.id}`,
		);
	}

	private async requiredUserIdForInvoice(
		invoice: Stripe.Invoice,
	): Promise<string> {
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

	private async paymentReferencesFromInvoice(
		invoice: Stripe.Invoice,
	): Promise<PaymentReferences> {
		const references: PaymentReferences[] = [];

		for (const payment of invoice.payments?.data ?? []) {
			if (payment.status !== "paid") {
				continue;
			}

			if (payment.payment.payment_intent) {
				references.push(
					await this.paymentReferences(payment.payment.payment_intent),
				);
				continue;
			}

			const charge = payment.payment.charge;

			if (charge) {
				references.push({
					chargeId: this.expandableId(charge),
					paymentIntentId:
						typeof charge === "string"
							? null
							: this.expandableId(charge.payment_intent),
				});
			}
		}

		const distinctReferences = [
			...new Map(
				references
					.filter(
						(reference) =>
							reference.chargeId !== null || reference.paymentIntentId !== null,
					)
					.map((reference) => [
						`${reference.chargeId ?? ""}:${reference.paymentIntentId ?? ""}`,
						reference,
					]),
			).values(),
		];

		if (distinctReferences.length > 1) {
			throw new Error(
				`Stripe invoice ${invoice.id} has multiple paid payment sources; refusing to attach one full credit grant to an arbitrary charge`,
			);
		}

		const [reference] = distinctReferences;

		if (reference) {
			return reference;
		}

		if (typeof invoice.amount_paid === "number" && invoice.amount_paid > 0) {
			throw new Error(
				`Stripe invoice ${invoice.id} is paid but has no paid charge or payment intent`,
			);
		}

		return { chargeId: null, paymentIntentId: null };
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

	private async paymentReferences(
		paymentIntent: string | Stripe.PaymentIntent | null,
	): Promise<PaymentReferences> {
		const paymentIntentId = this.expandableId(paymentIntent);

		if (!paymentIntentId) {
			return { chargeId: null, paymentIntentId: null };
		}

		const resolved =
			typeof paymentIntent === "object" &&
			paymentIntent !== null &&
			paymentIntent.latest_charge
				? paymentIntent
				: await this.stripeProvider.retrievePaymentIntent(paymentIntentId);

		return {
			chargeId: this.expandableId(resolved.latest_charge),
			paymentIntentId,
		};
	}

	private async reconcileFinancialAdjustments(
		references: PaymentReferences,
	): Promise<void> {
		if (!references.chargeId) {
			return;
		}

		await this.paymentRefundsService.reconcileChargeAfterGrant(
			references.chargeId,
		);
	}

	private withPaymentReferences(
		meta: Record<string, unknown>,
		references: PaymentReferences,
	) {
		return {
			...meta,
			...(references.chargeId ? { chargeId: references.chargeId } : {}),
			...(references.paymentIntentId
				? { paymentIntentId: references.paymentIntentId }
				: {}),
		};
	}
}
