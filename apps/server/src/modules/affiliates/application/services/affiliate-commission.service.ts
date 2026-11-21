/**
 * Creates affiliate earnings for a paid Stripe invoice or a paid top-up Checkout Session.
 * Called by `StripeEventRouter`, the signup attribution hook, and the daily reconcile task.
 * Writes candidates and earnings through `AffiliatesRepository`, then runs the clawback reconcile.
 * Reads the top-up payer from `BillingCheckoutAttemptsRepository`.
 */
import { Inject, Injectable } from "@nestjs/common";
import { TOPUP_MIN_AMOUNT_USD } from "@wandit/contracts";
import type Stripe from "stripe";

import { BillingCheckoutAttemptsRepository } from "../../../billing/infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCustomersRepository } from "../../../billing/infrastructure/persistence/billing-customers.repository";
import { OrganizationBillingCustomersRepository } from "../../../billing/infrastructure/persistence/organization-billing-customers.repository";
import { StripeProvider } from "../../../billing/infrastructure/stripe/stripe.provider";
import {
	addDays,
	affiliateInvoiceBaseCents,
	attributionEarnsAt,
	isCommissionableBillingReason,
	percentageCommissionCents,
	TOPUP_BILLING_REASON,
} from "../../domain/affiliate-commission-policy";
import {
	type AffiliateAttributionRow,
	type AffiliateCandidateRow,
	AffiliatesRepository,
	type AffiliateTransaction,
} from "../../infrastructure/persistence/affiliates.repository";
import { AffiliateClawbackService } from "./affiliate-clawback.service";

/** One paid Stripe payment that can earn: an invoice or a top-up Checkout Session. */
type PaidSource = {
	/** Stripe invoice id (`in_`) or Checkout Session id (`cs_`). Key of the candidate and the earning. */
	sourceId: string;
	/** Stripe invoice `billing_reason`, or `TOPUP_BILLING_REASON`. */
	billingReason: string;
	/** Commission base in the minor unit of `currency`. Zero or less earns nothing. */
	rawBaseAmountCents: number;
	/** ISO 4217 code in lower case. */
	currency: string;
	/** Invoice paid_at, or latest_charge.created of a top-up. Sets the window and the hold. Must be equal on a replay. */
	paidAt: Date;
	/** Reads the funding charge id. Called only when the source earns. */
	resolveChargeId: () => Promise<string>;
	/** User who paid, from the checkout attempt. Null for an invoice: Stripe does not name the paying member. */
	payerUserId: string | null;
};

@Injectable()
export class AffiliateCommissionService {
	constructor(
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository: AffiliatesRepository,
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(OrganizationBillingCustomersRepository)
		private readonly organizationBillingCustomersRepository: OrganizationBillingCustomersRepository,
		@Inject(StripeProvider)
		private readonly stripeProvider: StripeProvider,
		@Inject(AffiliateClawbackService)
		private readonly clawbackService: AffiliateClawbackService,
		@Inject(BillingCheckoutAttemptsRepository)
		private readonly checkoutAttemptsRepository: BillingCheckoutAttemptsRepository,
	) {}

	async handlePaidInvoice(invoiceEvent: Stripe.Invoice): Promise<boolean> {
		if (!isCommissionableBillingReason(invoiceEvent.billing_reason)) {
			return false;
		}

		const invoice = await this.stripeProvider.retrieveInvoice(invoiceEvent.id);
		const userId = await this.earningUserIdForCustomer(
			this.expandableId(invoice.customer),
			`Stripe invoice ${invoice.id}`,
		);

		return this.processInvoiceAndReconcile(invoice, userId);
	}

	/**
	 * Earns on a paid top-up. `StripeEventRouter.routeTopupCheckout` calls it after `grantTopup`.
	 * A throw keeps the webhook `failed`; the unique session id keys make a retry a no-op.
	 */
	async handlePaidTopup(
		eventSession: Stripe.Checkout.Session,
	): Promise<boolean> {
		// The webhook payload and a retrieve give different paid times. One canonical read keeps a replay equal.
		const session = await this.stripeProvider.retrieveCheckoutSession(
			eventSession.id,
		);

		// Fraud rule: a top-up below 10 USD, such as the 1 USD Starter pass, earns no commission.
		// It writes no candidate, so the one fixed earning of a program stays for a real top-up.
		if (
			session.currency?.toLowerCase() === "usd" &&
			session.amount_total !== null &&
			session.amount_total < TOPUP_MIN_AMOUNT_USD * 100
		) {
			return false;
		}

		const userId = await this.earningUserIdForCustomer(
			this.expandableId(session.customer),
			`Stripe checkout session ${session.id}`,
		);

		return this.processPaidSourceAndReconcile(
			await this.topupPaidSource(session),
			userId,
		);
	}

	async reconcileCandidatesForUser(userId: string): Promise<number> {
		const candidates =
			await this.affiliatesRepository.listPendingCandidatesForUser(userId);
		let processed = 0;

		for (const candidate of candidates) {
			// A top-up candidate holds a `cs_` id. `retrieveInvoice` gives a 404 for it.
			const handled =
				candidate.billingReason === TOPUP_BILLING_REASON
					? await this.processPaidSourceAndReconcile(
							await this.topupPaidSource(
								await this.stripeProvider.retrieveCheckoutSession(
									candidate.stripeInvoiceId,
								),
							),
							userId,
						)
					: await this.processInvoiceAndReconcile(
							await this.stripeProvider.retrieveInvoice(
								candidate.stripeInvoiceId,
							),
							userId,
						);

			if (handled) {
				processed += 1;
			}
		}

		return processed;
	}

	/**
	 * Daily safety net for signup-hook/network failures. The candidate row stays
	 * pending until both earning creation and fresh charge reconciliation finish.
	 */
	async reconcilePendingAttributedCandidates(): Promise<number> {
		const userIds =
			await this.affiliatesRepository.listPendingAttributedCandidateUserIds();
		let reconciled = 0;
		const failures: unknown[] = [];

		for (const userId of userIds) {
			try {
				reconciled += await this.reconcileCandidatesForUser(userId);
			} catch (error) {
				failures.push(error);
			}
		}

		if (failures.length > 0) {
			throw new AggregateError(
				failures,
				`Failed to reconcile affiliate candidates for ${failures.length} user(s)`,
			);
		}

		return reconciled;
	}

	/**
	 * Gives the earning user of a Stripe customer. A team pays for its snapshot creator, never the buyer.
	 * Throws when the customer has no local owner, so the webhook is retried.
	 */
	private async earningUserIdForCustomer(
		customerId: string | null,
		sourceLabel: string,
	): Promise<string> {
		if (!customerId) {
			throw new Error(`${sourceLabel} has no customer`);
		}

		const customer =
			await this.billingCustomersRepository.findByProviderCustomerId(
				customerId,
			);

		if (customer) {
			return customer.userId;
		}

		// A team payment earns for the snapshot creator (attributionUserId). An invited member who pays never earns the commission.
		const orgCustomer =
			await this.organizationBillingCustomersRepository.findByProviderCustomerId(
				customerId,
			);

		if (!orgCustomer) {
			throw new Error(
				`${sourceLabel} customer ${customerId} has no local owner`,
			);
		}

		return orgCustomer.attributionUserId;
	}

	private async processInvoiceAndReconcile(
		invoice: Stripe.Invoice,
		userId: string,
	): Promise<boolean> {
		const source = this.invoicePaidSource(invoice);

		if (!source) {
			return false;
		}

		return this.processPaidSourceAndReconcile(source, userId);
	}

	private async processPaidSourceAndReconcile(
		source: PaidSource,
		userId: string,
	): Promise<boolean> {
		const { sourceId } = source;
		const handled = await this.processPaidSource(source, userId);

		if (!handled) {
			return false;
		}

		// A second short invoice-locked phase serializes post-commit Stripe state
		// reconciliation. Concurrent webhook deliveries may both observe the pending
		// earning, but only the first finalizer calls Stripe; later ones see processed
		// and cannot demote a successfully reconciled candidate on transient failure.
		return this.affiliatesRepository.withInvoiceLock(sourceId, async (tx) => {
			const candidate =
				await this.affiliatesRepository.lockCandidateByInvoiceId(sourceId, tx);

			if (!candidate) {
				throw new Error(`Affiliate candidate ${sourceId} disappeared`);
			}

			if (candidate.status === "processed") {
				return true;
			}

			if (candidate.status !== "pending_attribution") {
				throw new Error(
					`Affiliate candidate ${sourceId} became ${candidate.status} before reconciliation`,
				);
			}

			const reconciled =
				await this.clawbackService.reconcileInvoiceAfterEarning(sourceId, tx);

			if (!reconciled) {
				throw new Error(
					`Affiliate earning ${sourceId} disappeared before reconciliation`,
				);
			}

			await this.affiliatesRepository.setCandidateStatus(
				candidate.id,
				"processed",
				tx,
			);

			return true;
		});
	}

	private invoicePaidSource(invoice: Stripe.Invoice): PaidSource | null {
		const billingReason = invoice.billing_reason;

		if (!isCommissionableBillingReason(billingReason)) {
			return null;
		}

		const rawBaseAmountCents = affiliateInvoiceBaseCents({
			amountPaid: invoice.amount_paid,
			totalExcludingTax: invoice.total_excluding_tax,
		});
		const paidAtTimestamp = invoice.status_transitions.paid_at;

		if (
			typeof paidAtTimestamp !== "number" ||
			!Number.isSafeInteger(paidAtTimestamp) ||
			paidAtTimestamp <= 0
		) {
			throw new Error(
				`Stripe paid invoice ${invoice.id} has no valid paid_at timestamp`,
			);
		}

		return {
			billingReason,
			currency: invoice.currency.toLowerCase(),
			paidAt: new Date(paidAtTimestamp * 1_000),
			payerUserId: null,
			rawBaseAmountCents,
			// A funding charge is only required once this invoice is actually going
			// to earn. Non-attributed invoices must still leave their candidate row
			// behind for a later signup/attribution reconciliation.
			resolveChargeId: () => this.invoiceChargeId(invoice),
			sourceId: invoice.id,
		};
	}

	/**
	 * Reads the commission values of a top-up from a session that `retrieveCheckoutSession` gave.
	 * The paid time is `latest_charge.created`, the same on the webhook and on the sweep.
	 */
	private async topupPaidSource(
		session: Stripe.Checkout.Session,
	): Promise<PaidSource> {
		if (session.mode !== "payment" || session.payment_status !== "paid") {
			throw new Error(
				`Stripe top-up checkout session ${session.id} is not a paid payment session`,
			);
		}

		if (
			session.amount_total === null ||
			!Number.isSafeInteger(session.amount_total) ||
			!session.currency
		) {
			throw new Error(
				`Stripe top-up checkout session ${session.id} has no valid amount_total or currency`,
			);
		}

		// `retrieveCheckoutSession` expands `payment_intent.latest_charge`. A string means the expand failed.
		const paymentIntent = session.payment_intent;
		const charge =
			paymentIntent !== null && typeof paymentIntent === "object"
				? paymentIntent.latest_charge
				: null;

		if (charge === null || typeof charge !== "object") {
			throw new Error(
				`Stripe top-up checkout session ${session.id} has no expanded latest charge`,
			);
		}

		const attempt =
			await this.checkoutAttemptsRepository.findByProviderSessionId(session.id);
		const payerUserId = attempt?.userId;

		if (!payerUserId) {
			throw new Error(
				`Stripe top-up checkout session ${session.id} has no checkout attempt`,
			);
		}

		return {
			billingReason: TOPUP_BILLING_REASON,
			currency: session.currency.toLowerCase(),
			paidAt: new Date(charge.created * 1_000),
			payerUserId,
			// LIMIT: base is amount_total. Upgrade: subtract tax when Stripe Tax starts.
			rawBaseAmountCents: session.amount_total,
			resolveChargeId: async () => charge.id,
			sourceId: session.id,
		};
	}

	/**
	 * Shared earning path of invoices and top-ups, under the lock `affiliate-invoice:{sourceId}`.
	 * Writes the candidate, then at most one earning per source id. A replay with other values throws.
	 */
	private async processPaidSource(
		source: PaidSource,
		userId: string,
	): Promise<boolean> {
		const { currency, paidAt, rawBaseAmountCents, sourceId } = source;
		return this.affiliatesRepository.withInvoiceLock(sourceId, async (tx) => {
			const candidate = await this.affiliatesRepository.upsertCandidate(
				{
					baseAmountCents: Math.max(0, rawBaseAmountCents),
					billingReason: source.billingReason,
					currency,
					paidAt,
					stripeInvoiceId: sourceId,
					userId,
				},
				tx,
			);

			if (candidate.status !== "pending_attribution") {
				return candidate.status === "processed";
			}

			if (rawBaseAmountCents <= 0) {
				await this.affiliatesRepository.setCandidateStatus(
					candidate.id,
					"ineligible",
					tx,
				);
				return false;
			}

			const attribution =
				await this.affiliatesRepository.lockAttributionByUserId(userId, tx);

			if (!attribution) {
				return false;
			}

			if (
				!this.isEligibleAttribution(attribution, candidate) ||
				(await this.isPaidByAffiliate(source, attribution, tx))
			) {
				await this.affiliatesRepository.setCandidateStatus(
					candidate.id,
					"ineligible",
					tx,
				);
				return false;
			}

			const existingInvoiceEarning =
				await this.affiliatesRepository.findEarningByInvoiceId(sourceId, tx);

			let amountCents: number;
			let rateBps: number | null;

			if (attribution.programKind === "percentage_recurring") {
				if (attribution.commissionRateBps === null) {
					throw new Error(
						`Affiliate attribution ${attribution.id} has no percentage rate`,
					);
				}

				rateBps = attribution.commissionRateBps;
				amountCents = percentageCommissionCents(rawBaseAmountCents, rateBps);
			} else {
				if (
					attribution.fixedAmountCents === null ||
					attribution.fixedCurrency?.toLowerCase() !== currency
				) {
					await this.affiliatesRepository.setCandidateStatus(
						candidate.id,
						"ineligible",
						tx,
					);
					return false;
				}

				if (
					!existingInvoiceEarning &&
					(await this.affiliatesRepository.hasEarningForAttribution(
						attribution.id,
						tx,
					))
				) {
					await this.affiliatesRepository.setCandidateStatus(
						candidate.id,
						"ineligible",
						tx,
					);
					return false;
				}

				rateBps = null;
				// No commission is larger than its payment. A 10 USD top-up can be the first payment.
				// A replay keeps the stored amount: an earning from before the cap can be above its base.
				amountCents =
					existingInvoiceEarning?.amountCents ??
					Math.min(attribution.fixedAmountCents, rawBaseAmountCents);
			}

			if (amountCents <= 0) {
				await this.affiliatesRepository.setCandidateStatus(
					candidate.id,
					"ineligible",
					tx,
				);
				return false;
			}

			const chargeId = await source.resolveChargeId();

			const holdDays = await this.affiliatesRepository.holdDaysForAttribution(
				attribution.id,
				tx,
			);
			const earningInput = {
				attributionId: attribution.id,
				affiliateId: attribution.affiliateId,
				amountCents,
				baseAmountCents: rawBaseAmountCents,
				currency,
				holdUntil: addDays(paidAt, holdDays),
				rateBps,
				stripeChargeId: chargeId,
				stripeInvoiceId: sourceId,
			};
			const inserted = existingInvoiceEarning
				? null
				: await this.affiliatesRepository.insertEarning(earningInput, tx);
			const earning =
				existingInvoiceEarning ??
				inserted ??
				(await this.affiliatesRepository.findEarningByInvoiceId(sourceId, tx));

			if (!earning) {
				throw new Error(
					`Affiliate earning ${sourceId} conflicted but could not be reread`,
				);
			}

			if (
				earning.attributionId !== earningInput.attributionId ||
				earning.affiliateId !== earningInput.affiliateId ||
				earning.amountCents !== earningInput.amountCents ||
				earning.baseAmountCents !== earningInput.baseAmountCents ||
				earning.currency !== earningInput.currency ||
				earning.rateBps !== earningInput.rateBps ||
				earning.stripeChargeId !== earningInput.stripeChargeId
			) {
				throw new Error(
					`Affiliate earning ${sourceId} replay payload mismatch`,
				);
			}

			return true;
		});
	}

	private isEligibleAttribution(
		attribution: AffiliateAttributionRow,
		candidate: AffiliateCandidateRow,
	): boolean {
		return (
			attribution.status === "active" &&
			attributionEarnsAt(
				attribution.clickedAt,
				attribution.lockedAt,
				attribution.commissionDurationMonths,
				candidate.paidAt,
			)
		);
	}

	/**
	 * True when the user who paid is the affiliate of the attribution, for example a team member.
	 * LIMIT: a second account of the affiliate is not found; the hold stays. Upgrade: payment fingerprint match.
	 */
	private async isPaidByAffiliate(
		source: PaidSource,
		attribution: AffiliateAttributionRow,
		tx: AffiliateTransaction,
	): Promise<boolean> {
		if (source.payerUserId === null) {
			return false;
		}

		const affiliate =
			await this.affiliatesRepository.affiliateIdentityForSelfCheck(
				attribution.affiliateId,
				tx,
			);

		return affiliate?.userId === source.payerUserId;
	}

	private async invoiceChargeId(invoice: Stripe.Invoice): Promise<string> {
		const chargeIds: string[] = [];
		const payments =
			invoice.payments?.has_more === false
				? invoice.payments.data
				: await this.stripeProvider.listInvoicePayments(invoice.id);

		for (const payment of payments) {
			if (payment.status !== "paid") {
				continue;
			}

			const directChargeId = this.expandableId(payment.payment.charge);

			if (directChargeId) {
				chargeIds.push(directChargeId);
				continue;
			}

			const paymentIntentId = this.expandableId(payment.payment.payment_intent);

			if (!paymentIntentId) {
				continue;
			}

			const paymentIntent =
				typeof payment.payment.payment_intent === "object" &&
				payment.payment.payment_intent.latest_charge
					? payment.payment.payment_intent
					: await this.stripeProvider.retrievePaymentIntent(paymentIntentId);
			const chargeId = this.expandableId(paymentIntent.latest_charge);

			if (chargeId) {
				chargeIds.push(chargeId);
			}
		}

		const distinct = [...new Set(chargeIds)];

		if (distinct.length !== 1) {
			throw new Error(
				`Stripe invoice ${invoice.id} must have exactly one paid funding charge`,
			);
		}

		return distinct[0] as string;
	}

	private expandableId(value: unknown): string | null {
		if (typeof value === "string" && value.length > 0) {
			return value;
		}

		if (value && typeof value === "object" && "id" in value) {
			const id = (value as { id?: unknown }).id;
			return typeof id === "string" && id.length > 0 ? id : null;
		}

		return null;
	}
}
