import { Inject, Injectable, Logger } from "@nestjs/common";

import { FinancialReconciliationOutboxRepository } from "../../infrastructure/persistence/financial-reconciliation-outbox.repository";
import { PaymentRefundsService } from "./payment-refunds.service";

const FINANCIAL_RECONCILIATION_SWEEP_LIMIT = 100;

export type FinancialReconciliationSweepResult = {
	done: number;
	failed: number;
};

/**
 * Drains the post-grant reconciliation outbox: every row is a charge whose
 * credit grant committed but whose fresh-charge refund/dispute recheck may
 * have been lost to a crash. Rows are retried until the recheck succeeds.
 */
@Injectable()
export class FinancialReconciliationService {
	private readonly logger = new Logger(FinancialReconciliationService.name);

	constructor(
		@Inject(FinancialReconciliationOutboxRepository)
		private readonly outboxRepository: FinancialReconciliationOutboxRepository,
		@Inject(PaymentRefundsService)
		private readonly paymentRefundsService: PaymentRefundsService,
	) {}

	async sweep(
		limit = FINANCIAL_RECONCILIATION_SWEEP_LIMIT,
	): Promise<FinancialReconciliationSweepResult> {
		const rows = await this.outboxRepository.listPending(limit);
		const result: FinancialReconciliationSweepResult = { done: 0, failed: 0 };
		const reconciledCharges = new Set<string>();

		for (const row of rows) {
			if (reconciledCharges.has(row.chargeId)) {
				// markDoneForCharge already closed every pending row of this charge.
				continue;
			}

			try {
				await this.paymentRefundsService.reconcileChargeAfterGrant(
					row.chargeId,
				);
				result.done += await this.outboxRepository.markDoneForCharge(
					row.chargeId,
				);
				reconciledCharges.add(row.chargeId);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				await this.outboxRepository.markFailed(row.id, message);
				result.failed += 1;
				this.logger.error(
					`Financial reconciliation for charge ${row.chargeId} (${row.triggerRef}) failed and remains pending`,
					error instanceof Error ? error.stack : message,
				);
			}
		}

		return result;
	}
}
