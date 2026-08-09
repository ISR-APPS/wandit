import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertDatabaseConfiguration } from "./domain-operations.config";
import { orderRefundsQueue } from "./domain-task-queues";
import { createOrderRefundReconciliationRuntime } from "./order-refund.runtime";

/** DB-driven backstop for missed, canceled, and terminal refund handoffs. */
export const reconcileOrderRefundsTask = schedules.task({
	id: "reconcile-order-refunds",
	cron: { pattern: "*/5 * * * *", timezone: "UTC" },
	queue: orderRefundsQueue,
	retry: {
		factor: 2,
		maxAttempts: 5,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: false,
	},
	run: async (_payload, { ctx }) => {
		assertDatabaseConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createOrderRefundReconciliationRuntime(db);
			const result = await runtime.reconciler.execute();

			logger.info("Order refund reconciliation completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
