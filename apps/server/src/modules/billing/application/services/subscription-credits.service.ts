import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	CHECKOUT_PURPOSE,
	type ParsedPriceLookupKey,
	parsePriceLookupKey,
	priceLookupKey,
	TOPUP_PACKS,
	topupPackIdSchema,
} from "@wandit/contracts";
import type Stripe from "stripe";

import { CreditsService } from "../../../credits/application/services/credits.service";
import type { CreditsTransaction } from "../../../credits/infrastructure/persistence/credits.repository";
import { BillingCheckoutAttemptsRepository } from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import {
	type InvoiceApplicationRow,
	type SubscriptionCreditRow,
	SubscriptionCreditsRepository,
} from "../../infrastructure/persistence/subscription-credits.repository";
import { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";
import { StripeProvider } from "../../infrastructure/stripe/stripe.provider";
import { PaymentRefundsService } from "./payment-refunds.service";
import {
	type RefillFundingReferences,
	SubscriptionRefillService,
} from "./subscription-refill.service";

type ParsedInvoiceLine = {
	amount: number;
	lookupKey: string;
	parsed: ParsedPriceLookupKey;
	periodEnd: Date;
	periodStart: Date;
	proration: boolean;
};

type PaymentReferences = {
	chargeId: string | null;
	paymentIntentId: string | null;
};

type SubscriptionUpdatePlans = {
	newPlan: { lookupKey: string; parsed: ParsedPriceLookupKey };
	oldPlan: ParsedInvoiceLine | null;
};

@Injectable()
export class SubscriptionCreditsService {
	private readonly logger = new Logger(SubscriptionCreditsService.name);

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
		@Inject(SubscriptionCreditsRepository)
		private readonly subscriptionCreditsRepository: SubscriptionCreditsRepository,
		@Inject(SubscriptionRefillService)
		private readonly subscriptionRefillService: SubscriptionRefillService,
		@Inject(BillingCheckoutAttemptsRepository)
		private readonly checkoutAttemptsRepository: BillingCheckoutAttemptsRepository,
	) {}

	async grantTopup(session: Stripe.Checkout.Session): Promise<void> {
		if (session.payment_status !== "paid") {
			throw new Error(`Stripe checkout session ${session.id} is not paid`);
		}

		if (session.mode !== "payment") {
			throw new Error(
				`Stripe top-up checkout session ${session.id} must use payment mode`,
			);
		}

		const metadataAttemptId = this.requiredMetadata(
			session.metadata,
			"attemptId",
		);
		let attempt = await this.checkoutAttemptsRepository.findByProviderSessionId(
			session.id,
		);

		if (!attempt) {
			const unattached =
				await this.checkoutAttemptsRepository.findById(metadataAttemptId);

			if (
				unattached?.purpose === CHECKOUT_PURPOSE.topup &&
				unattached.status === "created" &&
				unattached.providerSessionId === null
			) {
				attempt = await this.checkoutAttemptsRepository.withUserLock(
					unattached.userId,
					(tx) =>
						this.checkoutAttemptsRepository.attachSession(
							unattached.id,
							session.id,
							tx,
						),
				);
			}
		}

		if (!attempt) {
			throw new Error(
				`Stripe top-up checkout session ${session.id} has no persisted checkout attempt`,
			);
		}

		if (attempt.purpose !== CHECKOUT_PURPOSE.topup) {
			throw new Error(
				`Billing checkout attempt ${attempt.id} has purpose ${attempt.purpose}, expected topup`,
			);
		}

		if (
			attempt.status !== "session_attached" &&
			attempt.status !== "completed"
		) {
			throw new Error(
				`Billing checkout attempt ${attempt.id} has non-fulfillable status ${attempt.status}`,
			);
		}

		if (attempt.priceLookupKey !== null) {
			throw new Error(
				`Top-up checkout attempt ${attempt.id} unexpectedly has a subscription price`,
			);
		}

		const metadataPurpose = this.requiredMetadata(session.metadata, "purpose");

		if (metadataPurpose !== CHECKOUT_PURPOSE.topup) {
			throw new Error(
				`Stripe checkout session ${session.id} has purpose ${metadataPurpose}, expected topup`,
			);
		}

		if (metadataAttemptId !== attempt.id) {
			throw new Error(
				`Stripe checkout session ${session.id} attempt metadata does not match persisted attempt ${attempt.id}`,
			);
		}

		const userId = this.requiredMetadata(session.metadata, "userId");

		if (userId !== attempt.userId) {
			throw new Error(
				`Stripe checkout session ${session.id} user metadata does not match checkout attempt ${attempt.id}`,
			);
		}

		const metadataPackId = this.requiredMetadata(session.metadata, "packId");
		const parsedPackId = topupPackIdSchema.safeParse(metadataPackId);

		if (!parsedPackId.success) {
			throw new Error(
				`Stripe checkout session ${session.id} has unknown top-up pack ${metadataPackId}`,
			);
		}

		const packId = parsedPackId.data;

		if (attempt.packId !== packId) {
			throw new Error(
				`Stripe checkout session ${session.id} pack ${packId} does not match checkout attempt ${attempt.id}`,
			);
		}

		const pack = TOPUP_PACKS[packId];
		const credits = this.positiveIntegerMetadata(session.metadata, "credits");

		if (credits !== pack.credits) {
			throw new Error(
				`Stripe checkout session ${session.id} credits ${credits} do not match top-up pack ${packId}`,
			);
		}

		const expectedAmountTotal = Math.round(pack.usd * 100);

		if (session.amount_total !== expectedAmountTotal) {
			throw new Error(
				`Stripe checkout session ${session.id} amount_total does not match top-up pack ${packId}`,
			);
		}

		if (session.currency?.toLowerCase() !== "usd") {
			throw new Error(
				`Stripe checkout session ${session.id} currency does not match top-up pack ${packId}`,
			);
		}

		const customer = await this.billingCustomersRepository.findByUserId(userId);
		const providerCustomerId = this.expandableId(session.customer);

		if (
			customer?.provider !== "stripe" ||
			!providerCustomerId ||
			customer.providerCustomerId !== providerCustomerId
		) {
			throw new Error(
				`Stripe checkout session ${session.id} customer does not match the billing customer for user ${userId}`,
			);
		}

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

		if (attempt.status === "session_attached") {
			const completed = await this.checkoutAttemptsRepository.withUserLock(
				userId,
				(tx) =>
					this.checkoutAttemptsRepository.markCompletedBySession(
						session.id,
						tx,
					),
			);

			if (!completed) {
				throw new Error(
					`Billing checkout attempt ${attempt.id} could not be marked completed after top-up fulfillment`,
				);
			}
		}

		await this.reconcileFinancialAdjustments(paymentReferences);
	}

	async expireForDeletedSubscription(
		subscription: Stripe.Subscription,
	): Promise<void> {
		/*
		 * The local mirror owns the credit bucket. Never trust webhook metadata
		 * enough to choose which user's advisory lock or balance to mutate.
		 */
		const tracked =
			await this.subscriptionsRepository.findByProviderSubscriptionId(
				subscription.id,
			);

		if (!tracked) {
			this.logger.warn(
				`Skipping terminal credit expiry for untracked subscription ${subscription.id}`,
			);

			return;
		}

		await this.assertSubscriptionOwnership(subscription, tracked.userId);
		const userId = tracked.userId;

		await this.subscriptionCreditsRepository.withUserLock(
			userId,
			async (tx) => {
				const deleted =
					await this.subscriptionCreditsRepository.findSubscriptionByProviderId(
						subscription.id,
						tx,
					);

				if (!deleted) {
					this.logger.warn(
						`Skipping terminal credit expiry for untracked subscription ${subscription.id}`,
					);

					return;
				}

				await this.subscriptionCreditsRepository.cancelPendingSlotsForSubscription(
					deleted.id,
					tx,
				);
				const anotherEntitled =
					await this.subscriptionCreditsRepository.findCanonicalEntitledByUserId(
						userId,
						tx,
					);

				if (anotherEntitled) {
					this.logger.warn(
						`Keeping plan credits after deletion of ${subscription.id}; entitled mirror ${anotherEntitled.providerSubscriptionId} remains`,
					);

					return;
				}

				await this.creditsService.expirePlanRemainder(
					userId,
					{
						idempotencyKey: `subdel:${subscription.id}`,
						meta: {
							providerSubscriptionId: subscription.id,
							reason: "subscription_ended",
						},
					},
					tx,
				);
			},
		);
	}

	async grantForPaidInvoice(eventInvoice: Stripe.Invoice): Promise<boolean> {
		const invoice = await this.stripeProvider.retrieveInvoice(eventInvoice.id);
		const billingReason = invoice.billing_reason;

		if (
			billingReason !== "subscription_create" &&
			billingReason !== "subscription_cycle" &&
			billingReason !== "subscription_update"
		) {
			return false;
		}

		const lines = await this.parsedInvoiceLines(invoice);
		const updatePlans =
			billingReason === "subscription_update"
				? this.subscriptionUpdatePlans(invoice, lines)
				: null;
		const currentPlan =
			updatePlans?.newPlan.parsed ??
			(billingReason === "subscription_cycle"
				? this.cyclePlanFromPaidInvoice(invoice, lines)
				: await this.currentPlanFromInvoice(invoice, lines));

		if (!currentPlan) {
			this.logger.warn(
				`Skipping Stripe invoice ${invoice.id} credit grant: unrecognized or missing price lookup key`,
			);

			return false;
		}

		const userId = await this.requiredUserIdForInvoice(invoice);
		const providerSubscriptionId = this.subscriptionIdFromInvoice(invoice);

		if (!providerSubscriptionId) {
			throw new Error(`Stripe invoice ${invoice.id} has no subscription`);
		}

		const paymentReferences = await this.paymentReferencesFromInvoice(invoice);
		let replayHasGrossGrant = false;
		const applied = await this.subscriptionCreditsRepository.withUserLock(
			userId,
			async (tx) => {
				const canonical =
					await this.subscriptionCreditsRepository.findCanonicalEntitledByUserId(
						userId,
						tx,
					);

				if (
					!canonical ||
					canonical.providerSubscriptionId !== providerSubscriptionId
				) {
					throw new Error(
						`Stripe invoice ${invoice.id} cannot resolve subscription ${providerSubscriptionId} as the canonical entitled mirror for user ${userId}`,
					);
				}

				const existing =
					await this.subscriptionCreditsRepository.findInvoiceApplication(
						invoice.id,
						tx,
					);

				if (existing) {
					this.assertInvoiceApplicationReplay(existing, {
						billingReason,
						subscriptionId: canonical.id,
					});

					// A process can die after the ledger/application commit but before
					// the fresh-charge reconciliation. Replays must finish that step.
					replayHasGrossGrant =
						await this.subscriptionCreditsRepository.hasGrossGrant(
							userId,
							`inv:${invoice.id}:grant`,
							tx,
						);

					return false;
				}

				if (billingReason === "subscription_update" && updatePlans?.oldPlan) {
					const predecessor =
						await this.subscriptionCreditsRepository.findLatestInvoiceApplication(
							canonical.id,
							tx,
						);

					if (
						!predecessor ||
						predecessor.newPriceLookupKey !== updatePlans.oldPlan.lookupKey ||
						!this.predecessorCoversOldPlanPeriod(
							predecessor,
							updatePlans.oldPlan,
						)
					) {
						throw new Error(
							`Stripe subscription update invoice ${invoice.id} arrived before its ${updatePlans.oldPlan.lookupKey} predecessor for the same paid period was applied`,
						);
					}
				}

				const period = this.invoicePeriod(lines, canonical);
				const effectiveCurrentPlan = currentPlan;
				const newLookupKey =
					updatePlans?.newPlan.lookupKey ??
					this.lookupKeyForParsedPlan(effectiveCurrentPlan);
				const oldLookupKey = updatePlans?.oldPlan?.lookupKey ?? null;
				const applicationBase = {
					billingReason,
					newPriceLookupKey: newLookupKey,
					oldPriceLookupKey: oldLookupKey,
					periodEnd: period.end,
					periodStart: period.start,
					stripeInvoiceId: invoice.id,
					subscriptionId: canonical.id,
				};

				if (billingReason === "subscription_cycle") {
					const newerCycle =
						await this.subscriptionCreditsRepository.findCycleAtOrAfter(
							canonical.id,
							period.end,
							tx,
						);

					if (newerCycle) {
						await this.subscriptionCreditsRepository.insertInvoiceApplication(
							{ ...applicationBase, creditsDelta: 0 },
							tx,
						);
						this.logger.warn(
							`Skipping stale subscription cycle invoice ${invoice.id}; ${newerCycle.stripeInvoiceId} already covers period ending ${newerCycle.periodEnd.toISOString()}`,
						);

						return false;
					}
				}

				const policySubscription =
					billingReason === "subscription_update"
						? canonical
						: {
								...canonical,
								currentPeriodEnd: period.end,
								currentPeriodStart: period.start,
							};
				const funding = {
					...paymentReferences,
					invoiceId: invoice.id,
				};
				let creditsDelta = 0;

				switch (billingReason) {
					case "subscription_create":
						creditsDelta = await this.handleInitialSubscriptionInvoice(
							invoice,
							policySubscription,
							effectiveCurrentPlan,
							funding,
							tx,
						);
						break;
					case "subscription_cycle":
						creditsDelta = await this.handleSubscriptionCycleInvoice(
							invoice,
							policySubscription,
							effectiveCurrentPlan,
							funding,
							tx,
						);
						break;
					case "subscription_update":
						creditsDelta = await this.handleSubscriptionUpdateInvoice(
							invoice,
							policySubscription,
							effectiveCurrentPlan,
							updatePlans,
							funding,
							tx,
						);
						break;
				}

				await this.subscriptionCreditsRepository.insertInvoiceApplication(
					{ ...applicationBase, creditsDelta },
					tx,
				);
				if (
					billingReason === "subscription_cycle" &&
					canonical.pendingAppliedBy !== null
				) {
					await this.subscriptionsRepository.clearAppliedPendingTier(
						providerSubscriptionId,
						tx,
					);
				}

				return true;
			},
		);

		if (applied || replayHasGrossGrant) {
			await this.reconcileFinancialAdjustments(paymentReferences);
		}

		return true;
	}

	private async handleInitialSubscriptionInvoice(
		invoice: Stripe.Invoice,
		subscription: SubscriptionCreditRow,
		currentPlan: ParsedPriceLookupKey,
		funding: RefillFundingReferences,
		tx: CreditsTransaction,
	): Promise<number> {
		await this.creditsService.grant(
			subscription.userId,
			this.allotment(currentPlan),
			{
				bucket: "plan",
				idempotencyKey: `inv:${invoice.id}:grant`,
				meta: this.withPaymentReferences(
					{
						invoiceId: invoice.id,
						reason: "subscription_initial",
						subscriptionId: subscription.id,
					},
					funding,
				),
			},
			tx,
		);

		if (currentPlan.interval === "year") {
			await this.subscriptionRefillService.createYearlySlots(
				{
					credits: currentPlan.tierCredits,
					funding,
					remainingAfter: subscription.currentPeriodStart,
					subscription,
				},
				tx,
			);
		}

		return currentPlan.tierCredits;
	}

	private async handleSubscriptionCycleInvoice(
		invoice: Stripe.Invoice,
		subscription: SubscriptionCreditRow,
		currentPlan: ParsedPriceLookupKey,
		funding: RefillFundingReferences,
		tx: CreditsTransaction,
	): Promise<number> {
		if (currentPlan.interval === "year") {
			await this.subscriptionRefillService.grantDuePendingSlots(
				subscription,
				this.invoicePaidAt(invoice),
				tx,
			);
		}

		const refill = await this.creditsService.applyCappedRefill(
			subscription.userId,
			this.allotment(currentPlan),
			{
				idempotencyKey: `inv:${invoice.id}:grant`,
				meta: this.withPaymentReferences(
					{
						invoiceId: invoice.id,
						reason: "subscription_cycle",
						subscriptionId: subscription.id,
					},
					funding,
				),
			},
			tx,
		);

		if (currentPlan.interval === "year") {
			await this.subscriptionRefillService.replacePendingYearlySlots(
				{
					credits: currentPlan.tierCredits,
					funding,
					grantDueThrough: this.invoicePaidAt(invoice),
					remainingAfter: subscription.currentPeriodStart,
					subscription,
				},
				tx,
			);
		}

		return currentPlan.tierCredits - refill.expiredCredits;
	}

	private async handleSubscriptionUpdateInvoice(
		invoice: Stripe.Invoice,
		subscription: SubscriptionCreditRow,
		currentPlan: ParsedPriceLookupKey,
		plans: SubscriptionUpdatePlans | null,
		funding: RefillFundingReferences,
		tx: CreditsTransaction,
	): Promise<number> {
		const oldPlan = plans?.oldPlan;
		const newPlan = plans?.newPlan;
		if (!oldPlan || !newPlan) {
			throw new Error(
				`Stripe subscription update invoice ${invoice.id} does not identify both old and new prices`,
			);
		}

		if (
			oldPlan.parsed.interval === "year" &&
			newPlan.parsed.interval === "month"
		) {
			throw new Error(
				`Unsupported yearly-to-monthly transition reached invoice ${invoice.id}`,
			);
		}

		if (oldPlan.parsed.interval === newPlan.parsed.interval) {
			const delta = currentPlan.tierCredits - oldPlan.parsed.tierCredits;

			if (delta <= 0) {
				return 0;
			}

			if (currentPlan.interval === "year") {
				await this.subscriptionRefillService.grantDuePendingSlots(
					subscription,
					this.invoicePaidAt(invoice),
					tx,
				);
			}

			await this.creditsService.grant(
				subscription.userId,
				delta,
				{
					bucket: "plan",
					idempotencyKey: `inv:${invoice.id}:grant`,
					meta: this.withPaymentReferences(
						{
							invoiceId: invoice.id,
							newPriceLookupKey: newPlan.lookupKey,
							oldPriceLookupKey: oldPlan.lookupKey,
							reason: "subscription_update",
							subscriptionId: subscription.id,
						},
						funding,
					),
				},
				tx,
			);

			if (currentPlan.interval === "year") {
				await this.subscriptionRefillService.replacePendingYearlySlots(
					{
						credits: currentPlan.tierCredits,
						funding,
						grantDueThrough: this.invoicePaidAt(invoice),
						remainingAfter: this.invoicePaidAt(invoice),
						subscription,
					},
					tx,
				);
			}

			return delta;
		}

		const refill = await this.creditsService.applyCappedRefill(
			subscription.userId,
			currentPlan.tierCredits,
			{
				idempotencyKey: `inv:${invoice.id}:grant`,
				meta: this.withPaymentReferences(
					{
						invoiceId: invoice.id,
						newPriceLookupKey: newPlan.lookupKey,
						oldPriceLookupKey: oldPlan.lookupKey,
						reason: "subscription_update_interval_change",
						subscriptionId: subscription.id,
					},
					funding,
				),
			},
			tx,
		);
		if (newPlan.parsed.interval === "year") {
			await this.subscriptionRefillService.replacePendingYearlySlots(
				{
					credits: newPlan.parsed.tierCredits,
					funding,
					grantDueThrough: this.invoicePaidAt(invoice),
					remainingAfter: subscription.currentPeriodStart,
					subscription,
				},
				tx,
			);
		}

		return currentPlan.tierCredits - refill.expiredCredits;
	}

	private async assertSubscriptionOwnership(
		subscription: Stripe.Subscription,
		expectedUserId: string,
	): Promise<void> {
		const metadataUserId = subscription.metadata.userId;

		if (metadataUserId && metadataUserId !== expectedUserId) {
			throw new Error(
				`Stripe subscription ${subscription.id} metadata owner does not match its local mirror`,
			);
		}

		const customerId = this.expandableId(subscription.customer);

		if (customerId) {
			const customer =
				await this.billingCustomersRepository.findByProviderCustomerId(
					customerId,
				);

			if (customer) {
				if (customer.userId !== expectedUserId) {
					throw new Error(
						`Stripe subscription ${subscription.id} customer owner does not match its local mirror`,
					);
				}

				return;
			}
		}
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
		parsedLines?: ParsedInvoiceLine[],
	): Promise<ParsedPriceLookupKey | null> {
		const lines = parsedLines ?? (await this.parsedInvoiceLines(invoice));
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

	private cyclePlanFromPaidInvoice(
		invoice: Stripe.Invoice,
		lines: ParsedInvoiceLine[],
	): ParsedPriceLookupKey {
		const distinctPlans = [
			...new Map(
				lines
					.filter((line) => !line.proration)
					.map((line) => [line.lookupKey, line.parsed]),
			).values(),
		];

		if (distinctPlans.length !== 1) {
			throw new Error(
				`Stripe subscription cycle invoice ${invoice.id} does not identify exactly one paid recurring price`,
			);
		}

		const [plan] = distinctPlans;

		if (!plan) {
			throw new Error(
				`Stripe subscription cycle invoice ${invoice.id} has no paid recurring price`,
			);
		}

		return plan;
	}

	private subscriptionUpdatePlans(
		invoice: Stripe.Invoice,
		lines: ParsedInvoiceLine[],
	): SubscriptionUpdatePlans {
		const positiveProrationLines = lines.filter(
			(line) => line.proration && line.amount > 0,
		);
		const candidateLines =
			positiveProrationLines.length > 0
				? positiveProrationLines
				: lines.some((line) => !line.proration && line.amount > 0)
					? lines.filter((line) => !line.proration && line.amount > 0)
					: lines.filter((line) => line.proration && line.amount === 0);
		const distinctNewPlans = [
			...new Map(candidateLines.map((line) => [line.lookupKey, line])).values(),
		];

		if (distinctNewPlans.length !== 1) {
			throw new Error(
				`Stripe subscription update invoice ${invoice.id} does not identify exactly one positive target price`,
			);
		}

		const [currentPlan] = distinctNewPlans;

		if (!currentPlan) {
			throw new Error(
				`Stripe subscription update invoice ${invoice.id} has no target price`,
			);
		}

		const oldPlan =
			lines.find(
				(line) =>
					line.proration &&
					line.amount < 0 &&
					line.lookupKey !== currentPlan.lookupKey,
			) ?? null;

		return {
			newPlan: {
				lookupKey: currentPlan.lookupKey,
				parsed: currentPlan.parsed,
			},
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
				periodEnd: new Date(line.period.end * 1000),
				periodStart: new Date(line.period.start * 1000),
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
			if (
				typeof invoice.amount_paid === "number" &&
				invoice.amount_paid > 0 &&
				!reference.chargeId
			) {
				throw new Error(
					`Stripe invoice ${invoice.id} is paid but its payment intent has no funding charge`,
				);
			}

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
		// A yearly payment funds twelve monthly refills; it never mints all
		// twelve allotments into the ledger up front.
		return parsed.tierCredits;
	}

	private invoicePeriod(
		lines: ParsedInvoiceLine[],
		fallback: SubscriptionCreditRow,
	): { end: Date; start: Date } {
		const policyLine =
			lines.find((line) => !line.proration) ??
			lines.find((line) => line.amount > 0) ??
			lines[0];

		return policyLine
			? { end: policyLine.periodEnd, start: policyLine.periodStart }
			: {
					end: fallback.currentPeriodEnd,
					start: fallback.currentPeriodStart,
				};
	}

	private invoicePaidAt(invoice: Stripe.Invoice): Date {
		const paidAt = invoice.status_transitions?.paid_at;

		return new Date((paidAt ?? invoice.created) * 1000);
	}

	private assertInvoiceApplicationReplay(
		existing: InvoiceApplicationRow,
		expected: { billingReason: string; subscriptionId: string },
	): void {
		if (
			existing.subscriptionId !== expected.subscriptionId ||
			existing.billingReason !== expected.billingReason
		) {
			throw new Error(
				`Billing invoice application replay conflict for Stripe invoice ${existing.stripeInvoiceId}`,
			);
		}
	}

	private lookupKeyForParsedPlan(parsed: ParsedPriceLookupKey) {
		return priceLookupKey(parsed.plan, parsed.tierCredits, parsed.interval);
	}

	private predecessorCoversOldPlanPeriod(
		predecessor: InvoiceApplicationRow,
		oldPlan: ParsedInvoiceLine,
	): boolean {
		return (
			predecessor.periodStart.getTime() <= oldPlan.periodStart.getTime() &&
			predecessor.periodEnd.getTime() === oldPlan.periodEnd.getTime()
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
