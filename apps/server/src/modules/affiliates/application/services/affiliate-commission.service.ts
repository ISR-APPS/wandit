import { Inject, Injectable } from "@nestjs/common";
import type Stripe from "stripe";

import { BillingCustomersRepository } from "../../../billing/infrastructure/persistence/billing-customers.repository";
import { StripeProvider } from "../../../billing/infrastructure/stripe/stripe.provider";
import {
	addDays,
	affiliateInvoiceBaseCents,
	attributionEarnsAt,
	isCommissionableBillingReason,
	percentageCommissionCents,
} from "../../domain/affiliate-commission-policy";
import {
	type AffiliateAttributionRow,
	type AffiliateCandidateRow,
	AffiliatesRepository,
} from "../../infrastructure/persistence/affiliates.repository";
import { AffiliateClawbackService } from "./affiliate-clawback.service";

@Injectable()
export class AffiliateCommissionService {
	constructor(
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository: AffiliatesRepository,
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(StripeProvider)
		private readonly stripeProvider: StripeProvider,
		@Inject(AffiliateClawbackService)
		private readonly clawbackService: AffiliateClawbackService,
	) {}

	async handlePaidInvoice(invoiceEvent: Stripe.Invoice): Promise<boolean> {
		if (!isCommissionableBillingReason(invoiceEvent.billing_reason)) {
			return false;
		}

		const invoice = await this.stripeProvider.retrieveInvoice(invoiceEvent.id);
		const customerId = this.expandableId(invoice.customer);

		if (!customerId) {
			throw new Error(`Stripe invoice ${invoice.id} has no customer`);
		}

		const customer =
			await this.billingCustomersRepository.findByProviderCustomerId(
				customerId,
			);

		if (!customer) {
			throw new Error(
				`Stripe invoice ${invoice.id} customer ${customerId} has no local owner`,
			);
		}

		return this.processInvoiceAndReconcile(invoice, customer.userId);
	}

	async reconcileCandidatesForUser(userId: string): Promise<number> {
		const candidates =
			await this.affiliatesRepository.listPendingCandidatesForUser(userId);
		let processed = 0;

		for (const candidate of candidates) {
			const invoice = await this.stripeProvider.retrieveInvoice(
				candidate.stripeInvoiceId,
			);
			const handled = await this.processInvoiceAndReconcile(invoice, userId);

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

	private async processInvoiceAndReconcile(
		invoice: Stripe.Invoice,
		userId: string,
	): Promise<boolean> {
		const handled = await this.processInvoice(invoice, userId);

		if (!handled) {
			return false;
		}

		// A second short invoice-locked phase serializes post-commit Stripe state
		// reconciliation. Concurrent webhook deliveries may both observe the pending
		// earning, but only the first finalizer calls Stripe; later ones see processed
		// and cannot demote a successfully reconciled candidate on transient failure.
		return this.affiliatesRepository.withInvoiceLock(invoice.id, async (tx) => {
			const candidate =
				await this.affiliatesRepository.lockCandidateByInvoiceId(
					invoice.id,
					tx,
				);

			if (!candidate) {
				throw new Error(`Affiliate candidate ${invoice.id} disappeared`);
			}

			if (candidate.status === "processed") {
				return true;
			}

			if (candidate.status !== "pending_attribution") {
				throw new Error(
					`Affiliate candidate ${invoice.id} became ${candidate.status} before reconciliation`,
				);
			}

			const reconciled =
				await this.clawbackService.reconcileInvoiceAfterEarning(invoice.id, tx);

			if (!reconciled) {
				throw new Error(
					`Affiliate earning ${invoice.id} disappeared before reconciliation`,
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

	private async processInvoice(
		invoice: Stripe.Invoice,
		userId: string,
	): Promise<boolean> {
		const billingReason = invoice.billing_reason;

		if (!isCommissionableBillingReason(billingReason)) {
			return false;
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

		const paidAt = new Date(paidAtTimestamp * 1_000);
		const currency = invoice.currency.toLowerCase();
		return this.affiliatesRepository.withInvoiceLock(invoice.id, async (tx) => {
			const candidate = await this.affiliatesRepository.upsertCandidate(
				{
					baseAmountCents: Math.max(0, rawBaseAmountCents),
					billingReason,
					currency,
					paidAt,
					stripeInvoiceId: invoice.id,
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

			if (!this.isEligibleAttribution(attribution, candidate)) {
				await this.affiliatesRepository.setCandidateStatus(
					candidate.id,
					"ineligible",
					tx,
				);
				return false;
			}

			const existingInvoiceEarning =
				await this.affiliatesRepository.findEarningByInvoiceId(invoice.id, tx);

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
				amountCents = attribution.fixedAmountCents;
			}

			if (amountCents <= 0) {
				await this.affiliatesRepository.setCandidateStatus(
					candidate.id,
					"ineligible",
					tx,
				);
				return false;
			}

			// A funding charge is only required once this invoice is actually going
			// to earn. Non-attributed invoices must still leave their candidate row
			// behind for a later signup/attribution reconciliation.
			const chargeId = await this.invoiceChargeId(invoice);

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
				stripeInvoiceId: invoice.id,
			};
			const inserted = existingInvoiceEarning
				? null
				: await this.affiliatesRepository.insertEarning(earningInput, tx);
			const earning =
				existingInvoiceEarning ??
				inserted ??
				(await this.affiliatesRepository.findEarningByInvoiceId(
					invoice.id,
					tx,
				));

			if (!earning) {
				throw new Error(
					`Affiliate earning ${invoice.id} conflicted but could not be reread`,
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
					`Affiliate earning ${invoice.id} replay payload mismatch`,
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
