import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertBillingFinancialConfiguration } from "./billing-maintenance.config";
import { createAffiliateMaintenanceRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";

export const affiliateCommissionApprovalSweepTask = schedules.task({
	id: "affiliate-commission-approval-sweep",
	cron: { pattern: "0 4 * * *", timezone: "UTC" },
	maxDuration: 900,
	queue: billingFinancialQueue,
	retry: {
		factor: 2,
		maxAttempts: 5,
		maxTimeoutInMs: 8 * 60_000,
		minTimeoutInMs: 60_000,
		randomize: false,
	},
	run: async (_payload, { ctx }) => {
		assertBillingFinancialConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createAffiliateMaintenanceRuntime(db);
			let reconciliationError: unknown;
			let reconciled = 0;

			try {
				reconciled =
					await runtime.commission.reconcilePendingAttributedCandidates();
			} catch (error) {
				reconciliationError = error;
			}

			// Never let a candidate-reconciliation outage starve otherwise eligible
			// commission approvals. Throw only after both independent phases ran.
			const { approved } = await runtime.approval.sweepEligible();

			if (reconciliationError) {
				throw reconciliationError;
			}

			const result = { approved, reconciled };
			logger.info("Affiliate commission approval sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
