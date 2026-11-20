/**
 * Grants plan and top-up credits from paid Stripe invoices and checkout sessions.
 * Pricing v8: it writes no `expire` row, and a subscription deletion changes no credit.
 * StripeEventRouter calls it for Stripe webhooks. The Trigger.dev billing maintenance task
 * replays failed webhook events through the same router.
 * It writes credit_ledger and billing_invoice_applications through CreditsService and repositories.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	CHECKOUT_PURPOSE,
	creditsToCentiCredits,
	type ParsedPriceLookupKey,
	PERSISTED_TOPUP_PACKS,
	type PersistedTopupPackId,
	parsePriceLookupKey,
	persistedTopupPackIdSchema,
	priceLookupKey,
	priceUsdFor,
} from "@wandit/contracts";
import type Stripe from "stripe";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	creditOwnerKey,
	orgOwner,
	ownerFromIds,
	sameCreditOwner,
	userOwner,
} from "../../../credits/domain/credit-owner";
import type { CreditsTransaction } from "../../../credits/infrastructure/persistence/credits.repository";
import { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { lifecycleEventIdempotencyKey } from "../../../lifecycle-events/domain/lifecycle-event";
import {
	type BillingCheckoutAttemptRow,
	BillingCheckoutAttemptsRepository,
} from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import { BillingTopupReceiptsRepository } from "../../infrastructure/persistence/billing-topup-receipts.repository";
import { FinancialReconciliationOutboxRepository } from "../../infrastructure/persistence/financial-reconciliation-outbox.repository";
import { OrganizationBillingCustomersRepository } from "../../infrastructure/persistence/organization-billing-customers.repository";
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
	newPlan: {
		line: ParsedInvoiceLine;
		lookupKey: string;
		parsed: ParsedPriceLookupKey;
	};
	oldPlan: ParsedInvoiceLine | null;
};

type InvoiceGrantOutcome = {
	/** UNIT: centi-credits. */
	creditsDelta: number;
	/** Funding charges of catch-up refill slots granted inside this invoice. */
	slotFundingChargeIds: string[];
};

const NO_SLOT_CHARGES: string[] = [];

/** Result of the money checks of a paid top-up session: what the grant and the receipt write. */
type TopupGrant = {
	/** UNIT: USD cents. The USD value that set the credits. */
	amountUsdCents: number;
	/** UNIT: centi-credits. The ledger delta of the grant. */
	centiCredits: number;
	/** Pricing v7 pack of an old session. Null for a v8 amount top-up. */
	packId: PersistedTopupPackId | null;
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
		@Inject(SubscriptionCreditsRepository)
		private readonly subscriptionCreditsRepository: SubscriptionCreditsRepository,
		@Inject(SubscriptionRefillService)
		private readonly subscriptionRefillService: SubscriptionRefillService,
		@Inject(BillingCheckoutAttemptsRepository)
		private readonly checkoutAttemptsRepository: BillingCheckoutAttemptsRepository,
		@Inject(OrganizationBillingCustomersRepository)
		private readonly organizationBillingCustomersRepository: OrganizationBillingCustomersRepository,
		@Inject(FinancialReconciliationOutboxRepository)
		private readonly reconciliationOutbox: FinancialReconciliationOutboxRepository,
		@Inject(BillingTopupReceiptsRepository)
		private readonly topupReceiptsRepository: BillingTopupReceiptsRepository,
		@Inject(LifecycleEventsService)
		private readonly lifecycleEvents: LifecycleEventsService,
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

		// A v8 attempt stores its amount. An attempt with no amount comes from a pricing v7
		// pack session that was open at the deploy: the old pack checks keep it payable.
		const grant =
			attempt.amountUsdCents !== null && attempt.credits !== null
				? this.verifyAmountTopup(session, {
						amountUsdCents: attempt.amountUsdCents,
						centiCredits: attempt.credits,
						id: attempt.id,
					})
				: this.verifyPackTopup(session, attempt);

		// Owner resolution: org top-ups carry organizationId in the session
		// metadata AND on the attempt; both must agree, and the Stripe customer
		// must be the org's. Personal path is byte-identical to pre-teams.
		const metadataOrganizationId = session.metadata?.organizationId ?? null;

		if ((attempt.organizationId ?? null) !== metadataOrganizationId) {
			throw new Error(
				`Stripe checkout session ${session.id} workspace does not match checkout attempt ${attempt.id}`,
			);
		}

		const providerCustomerId = this.expandableId(session.customer);

		if (metadataOrganizationId) {
			const orgCustomer =
				await this.organizationBillingCustomersRepository.findByOrganizationId(
					metadataOrganizationId,
				);

			if (
				orgCustomer?.provider !== "stripe" ||
				!providerCustomerId ||
				orgCustomer.providerCustomerId !== providerCustomerId
			) {
				throw new Error(
					`Stripe checkout session ${session.id} customer does not match the billing customer for organization ${metadataOrganizationId}`,
				);
			}
		} else {
			const customer =
				await this.billingCustomersRepository.findByUserId(userId);

			if (
				customer?.provider !== "stripe" ||
				!providerCustomerId ||
				customer.providerCustomerId !== providerCustomerId
			) {
				throw new Error(
					`Stripe checkout session ${session.id} customer does not match the billing customer for user ${userId}`,
				);
			}
		}

		const owner = metadataOrganizationId
			? orgOwner(metadataOrganizationId)
			: userOwner(userId);
		const paymentReferences = await this.paymentReferences(
			session.payment_intent,
		);

		await this.subscriptionCreditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				// grant.centiCredits is already in the ledger unit. Do not multiply it.
				await this.creditsService.topup(
					owner,
					grant.centiCredits,
					{
						idempotencyKey: `topup:${session.id}`,
						meta: this.withPaymentReferences(
							{
								// A v7 pack grant keeps its old meta. A v8 grant names its USD amount.
								...(grant.packId
									? { packId: grant.packId }
									: { amountUsdCents: grant.amountUsdCents }),
								reason: "topup_purchase",
								sessionId: session.id,
							},
							paymentReferences,
						),
					},
					tx,
				);

				await this.topupReceiptsRepository.insertIfAbsent(
					{
						amountCents: session.amount_total ?? grant.amountUsdCents,
						amountUsdCents: grant.amountUsdCents,
						chargeId: paymentReferences.chargeId,
						credits: grant.centiCredits,
						currency: session.currency?.toLowerCase() ?? "usd",
						organizationId: metadataOrganizationId,
						packId: grant.packId,
						paidAt: this.checkoutSessionPaidAt(session),
						paymentIntentId: paymentReferences.paymentIntentId,
						provider: "stripe",
						providerReference: session.id,
						userId,
					},
					tx,
				);

				await this.lifecycleEvents.enqueue(
					{
						event: "payment_completed",
						idempotencyKey: lifecycleEventIdempotencyKey(
							"payment_completed",
							userId,
						),
						payload: { interval: "topup" },
						userId,
					},
					tx,
				);
			},
		);

		// Reconciliation remains a separate idempotent insert. A later crash leaves
		// the webhook failed so replay completes it, while the ledger, cash receipt,
		// and payment lifecycle row above are already committed atomically.
		if (paymentReferences.chargeId) {
			await this.reconciliationOutbox.enqueue({
				chargeId: paymentReferences.chargeId,
				triggerRef: `topup:${session.id}`,
			});
		}

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

	/**
	 * Money checks of a pricing v8 top-up session. The credits come from the attempt row only.
	 * Throws on a mismatch, so the webhook stays failed and grants nothing.
	 */
	private verifyAmountTopup(
		session: Stripe.Checkout.Session,
		attempt: {
			/** UNIT: USD cents, from `billing_checkout_attempts.amount_usd_cents`. */
			amountUsdCents: number;
			/** UNIT: centi-credits, from `billing_checkout_attempts.credits`. */
			centiCredits: number;
			id: string;
		},
	): TopupGrant {
		if (session.currency?.toLowerCase() !== "usd") {
			throw new Error(
				`Stripe checkout session ${session.id} currency is not usd for checkout attempt ${attempt.id}`,
			);
		}

		// The subtotal is the price before discounts and taxes, so tax cannot break this check.
		if (session.amount_subtotal !== attempt.amountUsdCents) {
			throw new Error(
				`Stripe checkout session ${session.id} amount_subtotal does not match checkout attempt ${attempt.id}`,
			);
		}

		// A discount keeps the subtotal but lowers the money paid. Full credits need the full price.
		if ((session.total_details?.amount_discount ?? 0) !== 0) {
			throw new Error(
				`Stripe checkout session ${session.id} has a discount, which a top-up does not allow`,
			);
		}

		return {
			amountUsdCents: attempt.amountUsdCents,
			centiCredits: attempt.centiCredits,
			packId: null,
		};
	}

	/** Money checks of a pricing v7 pack session: the pack of the attempt sets the price and the credits. */
	private verifyPackTopup(
		session: Stripe.Checkout.Session,
		attempt: BillingCheckoutAttemptRow,
	): TopupGrant {
		const metadataPackId = this.requiredMetadata(session.metadata, "packId");
		const parsedPackId = persistedTopupPackIdSchema.safeParse(metadataPackId);

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

		const pack = PERSISTED_TOPUP_PACKS[packId];
		// Stripe session metadata carries WHOLE display credits (pack identity);
		// the metadata check therefore compares whole credits.
		const credits = this.positiveIntegerMetadata(session.metadata, "credits");

		if (credits !== pack.credits) {
			throw new Error(
				`Stripe checkout session ${session.id} credits ${credits} do not match top-up pack ${packId}`,
			);
		}

		// Whole USD to USD cents.
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

		return {
			amountUsdCents: expectedAmountTotal,
			centiCredits: creditsToCentiCredits(pack.credits),
			packId,
		};
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
			// Throwing keeps the durable webhook row failed (retry, then
			// dead-letter) instead of acking a paid invoice with zero credits.
			throw new Error(
				`Stripe invoice ${invoice.id} (${billingReason}) has an unrecognized or missing price lookup key; line prices: ${this.invoiceLinePriceIds(invoice).join(", ") || "none"}`,
			);
		}

		this.assertInvoiceAmountMatchesCatalog(
			invoice,
			billingReason,
			currentPlan,
			updatePlans,
		);

		const owner = await this.requiredOwnerForInvoice(invoice);
		const providerSubscriptionId = this.subscriptionIdFromInvoice(invoice);

		if (!providerSubscriptionId) {
			throw new Error(`Stripe invoice ${invoice.id} has no subscription`);
		}

		const paymentReferences = await this.paymentReferencesFromInvoice(invoice);
		let replayHasGrossGrant = false;
		let slotFundingChargeIds: string[] = NO_SLOT_CHARGES;
		const applied = await this.subscriptionCreditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				// The journal row is the replay marker of the invoice. One row per
				// invoice id plus the key `inv:{invoiceId}:grant` give one grant only.
				const existing =
					await this.subscriptionCreditsRepository.findInvoiceApplication(
						invoice.id,
						tx,
					);
				// Pricing v8 (I4): a paid invoice grants also when the mirror is
				// `canceled`, for example a past_due invoice paid after the cutover.
				const canonical =
					await this.subscriptionCreditsRepository.findSubscriptionByProviderId(
						providerSubscriptionId,
						tx,
					);

				if (!canonical) {
					throw new Error(
						`Stripe invoice ${invoice.id} has no local subscription row for ${providerSubscriptionId}`,
					);
				}

				// Security: the lock and the grant use the owner of the Stripe customer.
				// The row must belong to that same pool, or another pool gets the credits.
				if (
					!sameCreditOwner(
						ownerFromIds(canonical.userId, canonical.organizationId),
						owner,
					)
				) {
					throw new Error(
						`Stripe invoice ${invoice.id} subscription ${providerSubscriptionId} does not belong to owner ${creditOwnerKey(owner)}`,
					);
				}

				if (existing) {
					this.assertInvoiceApplicationReplay(existing, {
						billingReason,
						subscriptionId: canonical.id,
					});

					// A process can die after the ledger/application commit but before
					// the fresh-charge reconciliation. Replays must finish that step.
					replayHasGrossGrant =
						await this.subscriptionCreditsRepository.hasGrossGrant(
							owner,
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
					amountPaidMinor:
						typeof invoice.amount_paid === "number"
							? invoice.amount_paid
							: null,
					billingReason,
					currency: invoice.currency ?? null,
					newPriceLookupKey: newLookupKey,
					oldPriceLookupKey: oldLookupKey,
					paidAt: invoice.status_transitions?.paid_at
						? new Date(invoice.status_transitions.paid_at * 1000)
						: null,
					periodEnd: period.end,
					periodStart: period.start,
					stripeInvoiceId: invoice.id,
					subscriptionId: canonical.id,
				};

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
				let outcome: InvoiceGrantOutcome;

				switch (billingReason) {
					case "subscription_create":
						outcome = await this.handleInitialSubscriptionInvoice(
							invoice,
							policySubscription,
							effectiveCurrentPlan,
							funding,
							tx,
						);
						break;
					case "subscription_cycle":
						outcome = await this.handleSubscriptionCycleInvoice(
							invoice,
							policySubscription,
							effectiveCurrentPlan,
							funding,
							tx,
						);
						break;
					case "subscription_update":
						outcome = await this.handleSubscriptionUpdateInvoice(
							invoice,
							policySubscription,
							effectiveCurrentPlan,
							updatePlans,
							funding,
							tx,
						);
						break;
				}

				slotFundingChargeIds = outcome.slotFundingChargeIds;
				await this.subscriptionCreditsRepository.insertInvoiceApplication(
					{ ...applicationBase, creditsDelta: outcome.creditsDelta },
					tx,
				);

				if (billingReason === "subscription_create") {
					await this.lifecycleEvents.enqueue(
						{
							event: "payment_completed",
							idempotencyKey: lifecycleEventIdempotencyKey(
								"payment_completed",
								canonical.userId,
							),
							payload: { interval: effectiveCurrentPlan.interval },
							userId: canonical.userId,
						},
						tx,
					);
				}

				if (paymentReferences.chargeId) {
					await this.reconciliationOutbox.enqueue(
						{
							chargeId: paymentReferences.chargeId,
							triggerRef: `inv:${invoice.id}`,
						},
						tx,
					);
				}

				if (
					billingReason === "subscription_cycle" &&
					canonical.pendingAppliedBy !== null &&
					canonical.pendingTierCredits === effectiveCurrentPlan.tierCredits &&
					(canonical.pendingPlan ?? canonical.plan) ===
						effectiveCurrentPlan.plan &&
					(canonical.pendingInterval ?? canonical.interval) ===
						effectiveCurrentPlan.interval
				) {
					await this.subscriptionsRepository.clearMatchingPendingTier(
						providerSubscriptionId,
						effectiveCurrentPlan.tierCredits,
						tx,
						{
							interval: effectiveCurrentPlan.interval,
							plan: effectiveCurrentPlan.plan,
						},
					);
				}

				return true;
			},
		);

		if (applied || replayHasGrossGrant) {
			await this.reconcileFinancialAdjustments(paymentReferences);
		}

		// Catch-up slots granted inside this invoice may be funded by an older
		// charge; each one gets the same fresh-charge recheck.
		for (const chargeId of slotFundingChargeIds) {
			if (chargeId !== paymentReferences.chargeId) {
				await this.reconcileFinancialAdjustments({
					chargeId,
					paymentIntentId: null,
				});
			}
		}

		return true;
	}

	/**
	 * Paid-invoice safety: the money Stripe collected must match the catalog
	 * before any credits are minted. Exact match (or $0 for trials, or a short
	 * payment whose gap is exactly the Stripe customer balance applied) on
	 * create/cycle; at most the full new price on updates (proration
	 * arithmetic); USD only. Any other value dead-letters for a human.
	 */
	private assertInvoiceAmountMatchesCatalog(
		invoice: Stripe.Invoice,
		billingReason:
			| "subscription_create"
			| "subscription_cycle"
			| "subscription_update",
		plan: ParsedPriceLookupKey,
		updatePlans: SubscriptionUpdatePlans | null,
	): void {
		const currency = invoice.currency?.toLowerCase();

		if (currency !== "usd") {
			throw new Error(
				`Stripe invoice ${invoice.id} is in ${currency ?? "an unknown currency"}; only usd invoices grant credits`,
			);
		}

		const amountPaid = invoice.amount_paid;

		if (!Number.isSafeInteger(amountPaid) || amountPaid < 0) {
			throw new Error(
				`Stripe invoice ${invoice.id} has an invalid amount_paid`,
			);
		}

		const expectedMinor = this.catalogPriceMinor(plan);

		if (billingReason === "subscription_update") {
			if (
				updatePlans?.oldPlan &&
				!parsePriceLookupKey(updatePlans.oldPlan.lookupKey)
			) {
				throw new Error(
					`Stripe invoice ${invoice.id} old price ${updatePlans.oldPlan.lookupKey} is not in the catalog`,
				);
			}

			if (amountPaid > expectedMinor) {
				throw new Error(
					`Stripe invoice ${invoice.id} paid ${amountPaid} minor units, above the ${expectedMinor} catalog price of ${this.lookupKeyForParsedPlan(plan)}`,
				);
			}

			return;
		}

		if (amountPaid === 0 || amountPaid === expectedMinor) {
			return;
		}

		// An anchor reset (ruling 7, e.g. year -> month) credits the unused
		// remainder to the Stripe customer balance. The next cycle invoices are
		// then paid partly from that balance: amount_paid is below the catalog
		// price, but the invoice total (pre-balance) still matches and the gap
		// equals the balance Stripe applied.
		const balanceApplied = this.customerBalanceAppliedMinor(invoice);

		if (
			amountPaid < expectedMinor &&
			balanceApplied > 0 &&
			amountPaid + balanceApplied === expectedMinor
		) {
			return;
		}

		throw new Error(
			`Stripe invoice ${invoice.id} (${billingReason}) paid ${amountPaid} minor units but the catalog price of ${this.lookupKeyForParsedPlan(plan)} is ${expectedMinor}; coupons and discounts are not modeled, review manually`,
		);
	}

	/**
	 * Customer balance Stripe consumed on this invoice, in minor units. Stripe
	 * stores credit as a negative balance: starting_balance -2000 and
	 * ending_balance 0 means 2000 minor units were applied. Falls back to
	 * `total - amount_paid` when the balance fields are absent and the
	 * pre-balance total is known.
	 */
	private customerBalanceAppliedMinor(invoice: Stripe.Invoice): number {
		const starting = invoice.starting_balance;
		const ending = invoice.ending_balance;

		if (Number.isSafeInteger(starting) && Number.isSafeInteger(ending)) {
			return Math.max(0, (ending as number) - (starting as number));
		}

		if (
			Number.isSafeInteger(invoice.total) &&
			Number.isSafeInteger(invoice.amount_paid)
		) {
			return Math.max(0, invoice.total - invoice.amount_paid);
		}

		return 0;
	}

	private catalogPriceMinor(plan: ParsedPriceLookupKey): number {
		return Math.round(
			priceUsdFor(plan.plan, plan.tierCredits, plan.interval) * 100,
		);
	}

	private invoiceLinePriceIds(invoice: Stripe.Invoice): string[] {
		return invoice.lines.data.flatMap((line) => {
			const price = line.pricing?.price_details?.price;

			return price ? [typeof price === "string" ? price : price.id] : [];
		});
	}

	/**
	 * Ruling 7: an upgrade that resets the billing anchor has two lines.
	 * One is the new plan at its full catalog price for a full period.
	 * The other is the old-plan proration credit. It is negative, or $0 just before renewal.
	 * A delta-priced (pre-deploy) update invoice has proration lines only and keeps the delta path.
	 */
	private isAnchorResetUpdate(plans: SubscriptionUpdatePlans): boolean {
		const line = plans.newPlan.line;

		return (
			!line.proration &&
			line.amount === this.catalogPriceMinor(plans.newPlan.parsed) &&
			plans.oldPlan !== null &&
			plans.oldPlan.amount <= 0
		);
	}

	private async handleInitialSubscriptionInvoice(
		invoice: Stripe.Invoice,
		subscription: SubscriptionCreditRow,
		currentPlan: ParsedPriceLookupKey,
		funding: RefillFundingReferences,
		tx: CreditsTransaction,
	): Promise<InvoiceGrantOutcome> {
		await this.creditsService.grant(
			ownerFromIds(subscription.userId, subscription.organizationId),
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
					credits: this.allotment(currentPlan),
					funding,
					remainingAfter: subscription.currentPeriodStart,
					subscription,
				},
				tx,
			);
		}

		return {
			creditsDelta: this.allotment(currentPlan),
			slotFundingChargeIds: NO_SLOT_CHARGES,
		};
	}

	private async handleSubscriptionCycleInvoice(
		invoice: Stripe.Invoice,
		subscription: SubscriptionCreditRow,
		currentPlan: ParsedPriceLookupKey,
		funding: RefillFundingReferences,
		tx: CreditsTransaction,
	): Promise<InvoiceGrantOutcome> {
		const slotFundingChargeIds = new Set<string>();

		if (currentPlan.interval === "year") {
			const due = await this.subscriptionRefillService.grantDuePendingSlots(
				subscription,
				this.invoicePaidAt(invoice),
				tx,
			);

			for (const chargeId of due.fundingChargeIds) {
				slotFundingChargeIds.add(chargeId);
			}
		}

		// Pricing v8 (I1): a plain grant of one allotment. The rollover cap and
		// its `expire` row are gone. A replay of an old capped-refill row passes.
		await this.creditsService.grant(
			ownerFromIds(subscription.userId, subscription.organizationId),
			this.allotment(currentPlan),
			{
				bucket: "plan",
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
			const replaced =
				await this.subscriptionRefillService.replacePendingYearlySlots(
					{
						credits: this.allotment(currentPlan),
						funding,
						grantDueThrough: this.invoicePaidAt(invoice),
						remainingAfter: subscription.currentPeriodStart,
						subscription,
					},
					tx,
				);

			for (const chargeId of replaced.fundingChargeIds) {
				slotFundingChargeIds.add(chargeId);
			}
		}

		// creditsDelta is in centi-credits, the unit of allotment().
		return {
			creditsDelta: this.allotment(currentPlan),
			slotFundingChargeIds: [...slotFundingChargeIds],
		};
	}

	private async handleSubscriptionUpdateInvoice(
		invoice: Stripe.Invoice,
		subscription: SubscriptionCreditRow,
		currentPlan: ParsedPriceLookupKey,
		plans: SubscriptionUpdatePlans | null,
		funding: RefillFundingReferences,
		tx: CreditsTransaction,
	): Promise<InvoiceGrantOutcome> {
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

		const slotFundingChargeIds = new Set<string>();
		const anchorReset = plans ? this.isAnchorResetUpdate(plans) : false;

		if (oldPlan.parsed.interval === newPlan.parsed.interval && !anchorReset) {
			// Delta-priced update (proration only): the customer paid the tier
			// difference, so the ledger gets the tier difference.
			const delta =
				this.allotment(currentPlan) - this.allotment(oldPlan.parsed);

			if (delta <= 0) {
				return { creditsDelta: 0, slotFundingChargeIds: NO_SLOT_CHARGES };
			}

			if (currentPlan.interval === "year") {
				const due = await this.subscriptionRefillService.grantDuePendingSlots(
					subscription,
					this.invoicePaidAt(invoice),
					tx,
				);

				for (const chargeId of due.fundingChargeIds) {
					slotFundingChargeIds.add(chargeId);
				}
			}

			await this.creditsService.grant(
				ownerFromIds(subscription.userId, subscription.organizationId),
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
				const replaced =
					await this.subscriptionRefillService.replacePendingYearlySlots(
						{
							credits: this.allotment(currentPlan),
							funding,
							grantDueThrough: this.invoicePaidAt(invoice),
							remainingAfter: this.invoicePaidAt(invoice),
							subscription,
						},
						tx,
					);

				for (const chargeId of replaced.fundingChargeIds) {
					slotFundingChargeIds.add(chargeId);
				}
			}

			return {
				creditsDelta: delta,
				slotFundingChargeIds: [...slotFundingChargeIds],
			};
		}

		// Anchor reset (Ruling 7) or interval change: the customer paid the full
		// new price now, so the full new allotment is granted. Pricing v8 (I1):
		// the old plan remainder stays in the wallet; no `expire` row.
		await this.creditsService.grant(
			ownerFromIds(subscription.userId, subscription.organizationId),
			this.allotment(currentPlan),
			{
				bucket: "plan",
				idempotencyKey: `inv:${invoice.id}:grant`,
				meta: this.withPaymentReferences(
					{
						invoiceId: invoice.id,
						newPriceLookupKey: newPlan.lookupKey,
						oldPriceLookupKey: oldPlan.lookupKey,
						reason:
							oldPlan.parsed.interval === newPlan.parsed.interval
								? "subscription_update_anchor_reset"
								: "subscription_update_interval_change",
						subscriptionId: subscription.id,
					},
					funding,
				),
			},
			tx,
		);
		if (newPlan.parsed.interval === "year") {
			const replaced =
				await this.subscriptionRefillService.replacePendingYearlySlots(
					{
						credits: this.allotment(newPlan.parsed),
						funding,
						grantDueThrough: this.invoicePaidAt(invoice),
						remainingAfter: subscription.currentPeriodStart,
						subscription,
					},
					tx,
				);

			for (const chargeId of replaced.fundingChargeIds) {
				slotFundingChargeIds.add(chargeId);
			}
		}

		return {
			creditsDelta: this.allotment(currentPlan),
			slotFundingChargeIds: [...slotFundingChargeIds],
		};
	}

	private async requiredOwnerForInvoice(
		invoice: Stripe.Invoice,
	): Promise<CreditOwner> {
		const owner = await this.ownerForInvoice(invoice);

		if (!owner) {
			throw new Error(
				`Could not resolve owner for Stripe invoice ${invoice.id}`,
			);
		}

		return owner;
	}

	/**
	 * Rung precedence (teams-workspaces.md §5.4): (1) subscription metadata —
	 * organizationId (the pool) wins over userId (the purchasing actor);
	 * (2) the local subscription mirror's owner; (3) the customer mapping —
	 * personal table first, then org customers.
	 *
	 * Every rung that resolves must agree on the owner. A disagreement means
	 * our own records contradict each other about which pool this money
	 * belongs to — dead-letter (throw) instead of silently granting the
	 * highest-precedence answer. This compares OWNER identity (the pool),
	 * never the purchasing actor.
	 */
	private async ownerForInvoice(
		invoice: Stripe.Invoice,
	): Promise<CreditOwner | null> {
		const metadataOrganizationId =
			invoice.parent?.subscription_details?.metadata?.organizationId ??
			this.expandedSubscriptionFromInvoice(invoice)?.metadata.organizationId;
		const metadataUserId =
			invoice.parent?.subscription_details?.metadata?.userId ??
			this.expandedSubscriptionFromInvoice(invoice)?.metadata.userId;
		const metadataOwner = metadataOrganizationId
			? orgOwner(metadataOrganizationId)
			: metadataUserId
				? userOwner(metadataUserId)
				: null;

		const providerSubscriptionId = this.subscriptionIdFromInvoice(invoice);
		const mirror = providerSubscriptionId
			? await this.subscriptionsRepository.findByProviderSubscriptionId(
					providerSubscriptionId,
				)
			: null;
		const mirrorOwner = mirror
			? ownerFromIds(mirror.userId, mirror.organizationId)
			: null;

		const customerId = this.expandableId(invoice.customer);
		let customerOwner: CreditOwner | null = null;

		if (customerId) {
			const customer =
				await this.billingCustomersRepository.findByProviderCustomerId(
					customerId,
				);

			if (customer) {
				customerOwner = userOwner(customer.userId);
			} else {
				const orgCustomer =
					await this.organizationBillingCustomersRepository.findByProviderCustomerId(
						customerId,
					);
				customerOwner = orgCustomer
					? orgOwner(orgCustomer.organizationId)
					: null;
			}
		}

		const resolved = [metadataOwner, mirrorOwner, customerOwner].filter(
			(owner): owner is CreditOwner => owner !== null,
		);

		for (const owner of resolved) {
			if (!sameCreditOwner(owner, resolved[0] as CreditOwner)) {
				throw new Error(
					`Stripe invoice ${invoice.id} owner rungs disagree: ` +
						resolved.map(creditOwnerKey).join(" vs "),
				);
			}
		}

		return metadataOwner ?? mirrorOwner ?? customerOwner;
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

		// An upgrade minutes before renewal has unused time below half a cent.
		// Stripe then writes the old-plan line at $0, so 0 must count here.
		const oldPlan =
			lines.find(
				(line) =>
					line.proration &&
					line.amount <= 0 &&
					line.lookupKey !== currentPlan.lookupKey,
			) ?? null;

		return {
			newPlan: {
				line: currentPlan,
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
		// The payments expansion on the invoice retrieve is best-effort (Stripe
		// depth caps can strip it); the list endpoint recovers the same rows.
		const payments =
			invoice.payments?.data ??
			(await this.stripeProvider.listInvoicePayments(invoice.id));

		for (const payment of payments) {
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
		// tierCredits is the WHOLE-credit tier identity (Stripe lookup keys);
		// this is the single x100 conversion to ledger centi-credits.
		return parsed.tierCredits * 100;
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
		// Fast path done; the sweep only sees rows a crash left pending.
		await this.reconciliationOutbox.markDoneForCharge(references.chargeId);
	}

	private checkoutSessionPaidAt(session: Stripe.Checkout.Session): Date {
		const paymentIntent = session.payment_intent;
		const created =
			typeof paymentIntent === "object" && paymentIntent !== null
				? paymentIntent.created
				: session.created;

		return new Date(created * 1000);
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
