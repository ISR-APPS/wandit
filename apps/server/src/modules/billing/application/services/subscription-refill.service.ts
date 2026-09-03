import { Inject, Injectable, Logger } from "@nestjs/common";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { ownerFromIds } from "../../../credits/domain/credit-owner";
import { FinancialReconciliationOutboxRepository } from "../../infrastructure/persistence/financial-reconciliation-outbox.repository";
import {
	type InsertRefillSlot,
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
	 * rows store centi-credits and flow into applyCappedRefill unchanged.
	 */
	credits: number;
	funding: RefillFundingReferences;
	grantDueThrough?: Date;
	remainingAfter: Date;
	subscription: SubscriptionCreditRow;
};

export type SubscriptionRefillSweepResult = {
	canceled: number;
	failed: number;
	granted: number;
	skipped: number;
};

export type DueSlotGrantResult = {
	/** Distinct funding charges of the claimed slots, for post-commit reconciliation. */
	fundingChargeIds: string[];
	granted: number;
};

@Injectable()
export class SubscriptionRefillService {
	private readonly logger = new Logger(SubscriptionRefillService.name);

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

			await this.creditsService.applyCappedRefill(
				ownerFromIds(subscription.userId, subscription.organizationId),
				claimed.credits,
				{
					capMultiplier: 1,
					idempotencyKey: `refill:${subscription.id}:${claimed.fundingInvoiceId}:${claimed.periodOrdinal}`,
					meta: {
						...(claimed.fundingChargeId
							? { chargeId: claimed.fundingChargeId }
							: {}),
						invoiceId: claimed.fundingInvoiceId,
						...(claimed.fundingPaymentIntentId
							? { paymentIntentId: claimed.fundingPaymentIntentId }
							: {}),
						periodOrdinal: claimed.periodOrdinal,
						reason: "yearly_subscription_refill",
						subscriptionId: subscription.id,
					},
				},
				transaction,
			);
			granted += 1;

			if (claimed.fundingChargeId) {
				fundingChargeIds.add(claimed.fundingChargeId);
				await this.reconciliationOutbox.enqueue(
					{
						chargeId: claimed.fundingChargeId,
						triggerRef: `slot:${claimed.id}`,
					},
					transaction,
				);
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

	async sweepDueSlots(
		now = new Date(),
		limit = 100,
	): Promise<SubscriptionRefillSweepResult> {
		const result: SubscriptionRefillSweepResult = {
			canceled: 0,
			failed: 0,
			granted: 0,
			skipped: 0,
		};
		const slotIds = await this.repository.listDueSlotIds(now, limit);

		for (const slotId of slotIds) {
			try {
				const outcome = await this.grantDueSlot(slotId, now);
				result[outcome] += 1;
			} catch (error) {
				result.failed += 1;
				this.logger.error(
					`Subscription refill slot ${slotId} failed and remains retryable`,
					error instanceof Error ? error.stack : String(error),
				);
			}
		}

		return result;
	}

	async grantDueSlot(
		slotId: string,
		now = new Date(),
	): Promise<"canceled" | "granted" | "skipped"> {
		const candidate = await this.repository.findSlotWithSubscription(slotId);

		if (candidate?.slot.status !== "pending") {
			if (
				candidate?.slot.status === "granted" &&
				candidate.slot.fundingChargeId
			) {
				// Complete a replay that may have crashed after the atomic ledger/slot
				// commit but before charge-state reconciliation.
				await this.paymentRefundsService.reconcileChargeAfterGrant(
					candidate.slot.fundingChargeId,
				);
			}

			return "skipped";
		}

		if (candidate.slot.fundingChargeId) {
			/*
			 * Reconcile before claiming too. If the charge was already refunded or
			 * disputed, the existing charge-locked clawback path cancels this pending
			 * slot, closing the hard-crash window after the later grant commit.
			 */
			await this.paymentRefundsService.reconcileChargeAfterGrant(
				candidate.slot.fundingChargeId,
			);
		}

		// The slot's OWNER is its subscription's owner entity — an org slot must
		// never resolve canonicality (or grant) through the provenance userId,
		// which may also carry a personal subscription (confirmed review finding).
		const slotOwner = ownerFromIds(
			candidate.subscription.userId,
			candidate.subscription.organizationId,
		);
		let fundingChargeId: string | null = null;
		const outcome = await this.repository.withOwnerLock(
			slotOwner,
			async (tx) => {
				const current = await this.repository.findSlotWithSubscription(
					slotId,
					tx,
				);

				if (
					current?.slot.status !== "pending" ||
					current.slot.dueAt.getTime() > now.getTime()
				) {
					return "skipped" as const;
				}

				const canonical = await this.repository.findCanonicalEntitledByOwner(
					ownerFromIds(
						current.subscription.userId,
						current.subscription.organizationId,
					),
					tx,
				);

				if (!canonical || canonical.id !== current.subscription.id) {
					await this.repository.cancelPendingSlot(
						slotId,
						{ reason: "ownership" },
						tx,
					);

					return "canceled" as const;
				}

				const claimed = await this.repository.claimDueSlot(slotId, now, tx);

				if (!claimed) {
					return "skipped" as const;
				}

				fundingChargeId = claimed.fundingChargeId;
				await this.creditsService.applyCappedRefill(
					ownerFromIds(canonical.userId, canonical.organizationId),
					claimed.credits,
					{
						capMultiplier: 1,
						idempotencyKey: `refill:${canonical.id}:${claimed.fundingInvoiceId}:${claimed.periodOrdinal}`,
						meta: {
							...(claimed.fundingChargeId
								? { chargeId: claimed.fundingChargeId }
								: {}),
							invoiceId: claimed.fundingInvoiceId,
							...(claimed.fundingPaymentIntentId
								? { paymentIntentId: claimed.fundingPaymentIntentId }
								: {}),
							periodOrdinal: claimed.periodOrdinal,
							reason: "yearly_subscription_refill",
							subscriptionId: canonical.id,
						},
					},
					tx,
				);

				if (claimed.fundingChargeId) {
					await this.reconciliationOutbox.enqueue(
						{ chargeId: claimed.fundingChargeId, triggerRef: `slot:${slotId}` },
						tx,
					);
				}

				return "granted" as const;
			},
		);

		// Re-read Stripe only after the slot and ledger commit. A refund/dispute
		// racing this grant is then reconciled from fresh charge state. The
		// outbox row enqueued in the transaction covers a crash before this.
		if (outcome === "granted" && fundingChargeId) {
			await this.paymentRefundsService.reconcileChargeAfterGrant(
				fundingChargeId,
			);
			await this.reconciliationOutbox.markDoneForCharge(fundingChargeId);
		}

		return outcome;
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
