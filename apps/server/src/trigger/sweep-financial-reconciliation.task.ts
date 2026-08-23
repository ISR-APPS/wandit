import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertBillingFinancialConfiguration } from "./billing-maintenance.config";
import { createFinancialReconciliationRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";

/**
 * Drains the post-grant reconciliation outbox. The inline fast path marks
 * rows done right after a grant commits; whatever a crash left pending gets
 * its fresh-charge refund/dispute recheck here.
 */
export const financialReconciliationSweepTask = schedules.task({
	id: "financial-reconciliation-outbox-sweep",
	cron: { pattern: "*/10 * * * *", timezone: "UTC" },
	maxDuration: 240,
	queue: billingFinancialQueue,
	retry: { maxAttempts: 1 },
	ttl: "9m",
	run: async (_payload, { ctx }) => {
		assertBillingFinancialConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createFinancialReconciliationRuntime(db);
			const result = await runtime.reconciliation.sweep();

			logger.info("Financial reconciliation outbox sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			if (result.failed > 0) {
				throw new Error(
					`Financial reconciliation sweep left ${result.failed} row(s) pending`,
				);
			}

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
