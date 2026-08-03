import { Inject, Injectable } from "@nestjs/common";
import type Stripe from "stripe";

import {
	isNonAdverseDisputeStatus,
	type NonAdverseDisputeStatus,
} from "../../../billing/domain/stripe-dispute-status";
import { StripeProvider } from "../../../billing/infrastructure/stripe/stripe.provider";
import { proportionalClawbackCents } from "../../domain/affiliate-commission-policy";
import {
	type AffiliateCommissionRow,
	AffiliatesRepository,
	type AffiliateTransaction,
} from "../../infrastructure/persistence/affiliates.repository";

type AdjustmentTrigger =
	| { kind: "dispute"; stripeDisputeId: string }
	| {
			kind: "dispute_won";
			resolution: NonAdverseDisputeStatus;
			stripeDisputeId: string;
	  }
	| { kind: "refund"; stripeRefundId?: string }
	| { kind: "state_reconciliation" };

type AdjustmentSource =
	| { kind: "dispute"; stripeDisputeId: string }
	| {
			kind: "dispute_won";
			resolution: NonAdverseDisputeStatus;
			stripeDisputeId: string;
	  }
	| { kind: "refund"; stripeRefundId: string };

@Injectable()
export class AffiliateClawbackService {
	constructor(
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository: AffiliatesRepository,
		@Inject(StripeProvider)
		private readonly stripeProvider: StripeProvider,
	) {}

	async handleChargeRefunded(chargeEvent: Stripe.Charge): Promise<boolean> {
		return this.reconcile(chargeEvent.id, { kind: "refund" });
	}

	async handleRefundUpdated(refund: Stripe.Refund): Promise<boolean> {
		if (refund.status !== "succeeded") {
			return false;
		}

		const chargeId = this.expandableId(refund.charge);

		if (!chargeId) {
			throw new Error(`Stripe refund ${refund.id} has no charge`);
		}

		return this.reconcile(chargeId, {
			kind: "refund",
			stripeRefundId: refund.id,
		});
	}

	async handleDisputeCreated(dispute: Stripe.Dispute): Promise<boolean> {
		const chargeId = this.expandableId(dispute.charge);

		if (!chargeId) {
			throw new Error(`Stripe dispute ${dispute.id} has no charge`);
		}

		return this.reconcile(chargeId, {
			kind: "dispute",
			stripeDisputeId: dispute.id,
		});
	}

	async handleDisputeWon(dispute: Stripe.Dispute): Promise<boolean> {
		if (!isNonAdverseDisputeStatus(dispute.status)) {
			return false;
		}

		const chargeId = this.expandableId(dispute.charge);

		if (!chargeId) {
			throw new Error(`Stripe dispute ${dispute.id} has no charge`);
		}

		return this.reconcile(chargeId, {
			kind: "dispute_won",
			resolution: dispute.status,
			stripeDisputeId: dispute.id,
		});
	}

	/**
	 * Closes the webhook-ordering window where a refund or dispute is handled
	 * before invoice.paid creates the affiliate earning.
	 */
	async reconcileInvoiceAfterEarning(
		invoiceId: string,
		client?: AffiliateTransaction,
	): Promise<boolean> {
		const earning = client
			? await this.affiliatesRepository.findEarningByInvoiceId(
					invoiceId,
					client,
				)
			: await this.affiliatesRepository.findEarningByInvoiceId(invoiceId);

		if (!earning) {
			return false;
		}

		return this.reconcile(
			earning.stripeChargeId,
			{ kind: "state_reconciliation" },
			client,
		);
	}

	private async reconcile(
		chargeId: string,
		trigger: AdjustmentTrigger,
		client?: AffiliateTransaction,
	): Promise<boolean> {
		const operation = async (tx: AffiliateTransaction): Promise<boolean> => {
			// Stripe is the financial source of truth. Refresh only after acquiring
			// the shared charge lock so an older concurrent snapshot cannot regress
			// a newer cumulative adjustment.
			const [charge, refunds, disputes] = await Promise.all([
				this.stripeProvider.retrieveCharge(chargeId),
				this.stripeProvider.listRefundsForCharge(chargeId),
				this.stripeProvider.listDisputesForCharge(chargeId),
			]);

			if (charge.id !== chargeId) {
				throw new Error(
					`Stripe charge refresh for affiliate clawback ${chargeId} returned ${charge.id}`,
				);
			}

			if (charge.amount <= 0) {
				return false;
			}

			const successfulRefundCents = refunds
				.filter((refund) => refund.status === "succeeded")
				.reduce((sum, refund) => sum + refund.amount, 0);
			const adverseDisputeCents = disputes
				.filter((dispute) => !isNonAdverseDisputeStatus(dispute.status))
				.reduce((sum, dispute) => sum + dispute.amount, 0);
			const adverseCents = Math.min(
				charge.amount,
				successfulRefundCents + adverseDisputeCents,
			);
			const earning = await this.affiliatesRepository.findEarningByChargeId(
				chargeId,
				tx,
			);

			if (!earning) {
				return false;
			}

			const adjustments = await this.affiliatesRepository.listAdjustments(
				earning.id,
				tx,
			);
			const currentAdjustmentCents = adjustments.reduce(
				(sum, adjustment) => sum + adjustment.amountCents,
				0,
			);
			const targetClawbackCents = Math.min(
				earning.amountCents,
				proportionalClawbackCents({
					adverseAmountCents: adverseCents,
					chargeAmountCents: charge.amount,
					earningAmountCents: earning.amountCents,
				}),
			);
			const desiredAdjustmentCents = -targetClawbackCents;
			const deltaCents = desiredAdjustmentCents - currentAdjustmentCents;

			if (deltaCents === 0) {
				return true;
			}

			const source = this.adjustmentSource({
				adjustments,
				deltaCents,
				disputes,
				refunds,
				trigger,
			});

			if (!source) {
				throw new Error(
					`Affiliate adjustment for Stripe charge ${chargeId} has no unused Stripe refund/dispute source`,
				);
			}

			const inserted = await this.affiliatesRepository.insertAdjustment(
				this.adjustmentInput(earning, source, deltaCents),
				tx,
			);

			if (!inserted) {
				throw new Error(
					`Affiliate adjustment for Stripe charge ${chargeId} conflicted before reaching its cumulative target`,
				);
			}

			return true;
		};

		if (client) {
			await this.affiliatesRepository.lockCharge(chargeId, client);
			return operation(client);
		}

		return this.affiliatesRepository.withChargeLock(chargeId, operation);
	}

	private adjustmentSource(input: {
		adjustments: AffiliateCommissionRow[];
		deltaCents: number;
		disputes: Stripe.Dispute[];
		refunds: Stripe.Refund[];
		trigger: AdjustmentTrigger;
	}): AdjustmentSource | null {
		if (input.deltaCents > 0) {
			const preferredId =
				input.trigger.kind === "dispute_won"
					? input.trigger.stripeDisputeId
					: undefined;
			const dispute = this.sortedDisputes(input.disputes).find(
				(candidate) =>
					isNonAdverseDisputeStatus(candidate.status) &&
					(preferredId === undefined || candidate.id === preferredId),
			);

			return dispute && isNonAdverseDisputeStatus(dispute.status)
				? {
						kind: "dispute_won",
						resolution: dispute.status,
						stripeDisputeId: dispute.id,
					}
				: null;
		}

		const usedRefundIds = new Set(
			input.adjustments.flatMap((row) =>
				row.stripeRefundId ? [row.stripeRefundId] : [],
			),
		);
		const usedDisputeIds = new Set(
			input.adjustments.flatMap((row) =>
				row.stripeDisputeId ? [row.stripeDisputeId] : [],
			),
		);
		const preferredDisputeId =
			input.trigger.kind === "dispute"
				? input.trigger.stripeDisputeId
				: undefined;
		const preferredDispute = this.sortedDisputes(input.disputes).find(
			(dispute) =>
				dispute.id === preferredDisputeId &&
				!isNonAdverseDisputeStatus(dispute.status) &&
				!usedDisputeIds.has(dispute.id),
		);

		if (preferredDispute) {
			return { kind: "dispute", stripeDisputeId: preferredDispute.id };
		}
		const preferredRefundId =
			input.trigger.kind === "refund"
				? input.trigger.stripeRefundId
				: undefined;
		const preferredRefund = input.refunds.find(
			(candidate) =>
				candidate.id === preferredRefundId &&
				candidate.status === "succeeded" &&
				!usedRefundIds.has(candidate.id),
		);

		if (preferredRefund) {
			return { kind: "refund", stripeRefundId: preferredRefund.id };
		}

		const refund = [...input.refunds]
			.filter(
				(candidate) =>
					candidate.status === "succeeded" && !usedRefundIds.has(candidate.id),
			)
			.sort(
				(left, right) =>
					right.created - left.created || right.id.localeCompare(left.id),
			)[0];

		if (refund) {
			return { kind: "refund", stripeRefundId: refund.id };
		}

		const dispute = this.sortedDisputes(input.disputes).find(
			(candidate) =>
				!isNonAdverseDisputeStatus(candidate.status) &&
				!usedDisputeIds.has(candidate.id),
		);

		return dispute ? { kind: "dispute", stripeDisputeId: dispute.id } : null;
	}

	private sortedDisputes(disputes: Stripe.Dispute[]): Stripe.Dispute[] {
		return [...disputes].sort(
			(left, right) =>
				(right.created ?? 0) - (left.created ?? 0) ||
				right.id.localeCompare(left.id),
		);
	}

	private adjustmentInput(
		earning: AffiliateCommissionRow,
		source: AdjustmentSource,
		amountCents: number,
	) {
		return {
			attributionId: earning.attributionId,
			affiliateId: earning.affiliateId,
			amountCents,
			baseAmountCents: earning.baseAmountCents,
			currency: earning.currency,
			holdUntil: earning.holdUntil,
			originalCommissionId: earning.id,
			rateBps: earning.rateBps,
			reversalReason:
				source.kind === "dispute_won"
					? `${
							source.resolution === "won"
								? "dispute_won"
								: `dispute_${source.resolution}`
						}:${source.stripeDisputeId}`
					: source.kind === "dispute"
						? "charge_dispute_created"
						: "charge_refunded",
			// Debt must become payout-visible immediately. Otherwise the approval
			// sweep can approve the earning while a concurrent negative adjustment
			// remains pending until tomorrow, allowing an avoidable overpayment.
			// Positive dispute compensation still observes the original hold/review.
			status:
				amountCents < 0 || earning.status !== "pending"
					? ("approved" as const)
					: ("pending" as const),
			stripeChargeId: earning.stripeChargeId,
			stripeDisputeId:
				source.kind === "dispute" ? source.stripeDisputeId : null,
			stripeInvoiceId: earning.stripeInvoiceId,
			stripeRefundId: source.kind === "refund" ? source.stripeRefundId : null,
		};
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
