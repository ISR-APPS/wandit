/**
 * Plans and grants the monthly refill slots of a yearly plan.
 * SubscriptionCreditsService calls it from the invoice handlers. The cutover script
 * calls grantPendingSlot. It writes slots and plain `plan` grants, never an `expire` row.
 */
import { Inject, Injectable } from "@nestjs/common";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { ownerFromIds } from "../../../credits/domain/credit-owner";
import { FinancialReconciliationOutboxRepository } from "../../infrastructure/persistence/financial-reconciliation-outbox.repository";
import {
	type InsertRefillSlot,
	type RefillSlotRow,
	type SubscriptionCreditRow,
	SubscriptionCreditsRepository,
	type SubscriptionCreditsTransaction,
} from "../../infrastructure/persistence/subscription-credits.repository";
import { PaymentRefundsService } from "./payment-refunds.service";

export type RefillFundingReferences = {
	chargeId: string | null;
	invoiceId: string;
	paymentIntentId: string | null;
};

export type YearlySlotPlan = {
	/**
	 * UNIT: integer centi-credits. Callers convert the whole-credit tier x100
	 * (subscription-credits.service allotment) before building the plan; slot
	 * rows store centi-credits and flow into CreditsService.grant unchanged.
	 */
	credits: number;
	funding: RefillFundingReferences;
	grantDueThrough?: Date;
	remainingAfter: Date;
	subscription: SubscriptionCreditRow;
};

export type DueSlotGrantResult = {
	/** Distinct funding charges of the claimed slots, for post-commit reconciliation. */
	fundingChargeIds: string[];
	granted: number;
};

@Injectable()
export class SubscriptionRefillService {
	constructor(
		@Inject(SubscriptionCreditsRepository)
		private readonly repository: SubscriptionCreditsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(PaymentRefundsService)
		private readonly paymentRefundsService: PaymentRefundsService,
		@Inject(FinancialReconciliationOutboxRepository)
		private readonly reconciliationOutbox: FinancialReconciliationOutboxRepository,
	) {}

	/**
	 * Grants the slots already due, cancels the rest as `replaced` by the new
	 * invoice, and plans the new invoice's slots. Returns the funding charges
	 * of the slots granted on the way so the caller reconciles each of them
	 * after commit (a claimed slot's charge can differ from the invoice's).
	 */
	async replacePendingYearlySlots(
		plan: YearlySlotPlan,
		transaction: SubscriptionCreditsTransaction,
	): Promise<DueSlotGrantResult> {
		const due = await this.grantDuePendingSlots(
			plan.subscription,
			plan.grantDueThrough ?? plan.remainingAfter,
			transaction,
		);
		await this.repository.cancelPendingSlotsForSubscription(
			plan.subscription.id,
			{ reason: "replaced", supersededByInvoiceId: plan.funding.invoiceId },
			transaction,
		);
		await this.createYearlySlots(plan, transaction);

		return due;
	}

	async grantDuePendingSlots(
		subscription: SubscriptionCreditRow,
		dueThrough: Date,
		transaction: SubscriptionCreditsTransaction,
	): Promise<DueSlotGrantResult> {
		const dueSlots = await this.repository.findDuePendingSlotsForSubscription(
			subscription.id,
			dueThrough,
			transaction,
		);
		const fundingChargeIds = new Set<string>();
		let granted = 0;

		for (const slot of dueSlots) {
			const claimed = await this.repository.claimDueSlot(
				slot.id,
				dueThrough,
				transaction,
			);

			if (!claimed) {
				continue;
			}

			await this.grantClaimedSlot(subscription, claimed, transaction);
			granted += 1;

			if (claimed.fundingChargeId) {
				fundingChargeIds.add(claimed.fundingChargeId);
			}
		}

		return { fundingChargeIds: [...fundingChargeIds], granted };
	}

	async createYearlySlots(
		plan: YearlySlotPlan,
		transaction: SubscriptionCreditsTransaction,
	): Promise<number> {
		const slots = this.yearlySlots(plan);
		await this.repository.insertRefillSlots(slots, transaction);

		// The unique key makes replayed insertion safe. Return the policy count,
		// not only newly inserted rows, so callers can audit the intended plan.
		return slots.length;
	}

	/**
	 * Grants one `pending` slot, due or not, in its own owner-lock transaction.
	 * Only the pay-as-you-go cutover script calls it. A slot in another state gives "skipped".
	 */
	async grantPendingSlot(
		slotId: string,
		now = new Date(),
	): Promise<"granted" | "skipped"> {
		const candidate = await this.repository.findSlotWithSubscription(slotId);

		if (candidate?.slot.status !== "pending") {
			return "skipped";
		}

		if (candidate.slot.fundingChargeId) {
			// A refunded or disputed charge cancels its pending slots through the
			// clawback path. Reconcile first, so a refunded month is never granted.
			await this.paymentRefundsService.reconcileChargeAfterGrant(
				candidate.slot.fundingChargeId,
			);
		}

		// The slot owner is the subscription owner. An org slot never grants to
		// the personal pool of the buyer in `userId`.
		const owner = ownerFromIds(
			candidate.subscription.userId,
			candidate.subscription.organizationId,
		);
		const claimed = await this.repository.withOwnerLock(owner, async (tx) => {
			const slot = await this.repository.claimPendingSlot(slotId, now, tx);

			if (slot) {
				await this.grantClaimedSlot(candidate.subscription, slot, tx);
			}

			return slot;
		});

		if (!claimed) {
			return "skipped";
		}

		// Read Stripe again only after the commit, so a refund that raced this
		// grant takes back its part. The outbox row covers a crash before this.
		if (claimed.fundingChargeId) {
			await this.paymentRefundsService.reconcileChargeAfterGrant(
				claimed.fundingChargeId,
			);
			await this.reconciliationOutbox.markDoneForCharge(
				claimed.fundingChargeId,
			);
		}

		return "granted";
	}

	yearlySlots(plan: YearlySlotPlan): InsertRefillSlot[] {
		if (!Number.isInteger(plan.credits) || plan.credits <= 0) {
			throw new Error("Yearly refill slot credits must be a positive integer");
		}

		const periodStart = plan.subscription.currentPeriodStart;
		const periodEnd = plan.subscription.currentPeriodEnd;
		const slots: InsertRefillSlot[] = [];

		for (let periodOrdinal = 2; periodOrdinal <= 12; periodOrdinal += 1) {
			const dueAt = this.addUtcCalendarMonths(periodStart, periodOrdinal - 1);

			if (
				dueAt.getTime() <= plan.remainingAfter.getTime() ||
				dueAt.getTime() >= periodEnd.getTime()
			) {
				continue;
			}

			slots.push({
				credits: plan.credits,
				dueAt,
				fundingChargeId: plan.funding.chargeId,
				fundingInvoiceId: plan.funding.invoiceId,
				fundingPaymentIntentId: plan.funding.paymentIntentId,
				periodOrdinal,
				status: "pending",
				subscriptionId: plan.subscription.id,
			});
		}

		return slots;
	}

	/**
	 * Plain `plan` grant of one claimed slot, plus its reconciliation outbox row.
	 * The key and the meta match the grants that older code wrote, so a replay passes.
	 * The refund code finds the grant by `meta.chargeId` and `meta.subscriptionId`.
	 */
	private async grantClaimedSlot(
		subscription: SubscriptionCreditRow,
		slot: RefillSlotRow,
		transaction: SubscriptionCreditsTransaction,
	): Promise<void> {
		await this.creditsService.grant(
			ownerFromIds(subscription.userId, subscription.organizationId),
			slot.credits,
			{
				bucket: "plan",
				idempotencyKey: `refill:${subscription.id}:${slot.fundingInvoiceId}:${slot.periodOrdinal}`,
				meta: {
					...(slot.fundingChargeId ? { chargeId: slot.fundingChargeId } : {}),
					invoiceId: slot.fundingInvoiceId,
					...(slot.fundingPaymentIntentId
						? { paymentIntentId: slot.fundingPaymentIntentId }
						: {}),
					periodOrdinal: slot.periodOrdinal,
					reason: "yearly_subscription_refill",
					subscriptionId: subscription.id,
				},
			},
			transaction,
		);

		if (slot.fundingChargeId) {
			await this.reconciliationOutbox.enqueue(
				{ chargeId: slot.fundingChargeId, triggerRef: `slot:${slot.id}` },
				transaction,
			);
		}
	}

	private addUtcCalendarMonths(anchor: Date, months: number): Date {
		const targetMonthIndex = anchor.getUTCMonth() + months;
		const targetYear =
			anchor.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
		const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
		const lastDay = new Date(
			Date.UTC(targetYear, targetMonth + 1, 0),
		).getUTCDate();
		const targetDay = Math.min(anchor.getUTCDate(), lastDay);

		return new Date(
			Date.UTC(
				targetYear,
				targetMonth,
				targetDay,
				anchor.getUTCHours(),
				anchor.getUTCMinutes(),
				anchor.getUTCSeconds(),
				anchor.getUTCMilliseconds(),
			),
		);
	}
}
