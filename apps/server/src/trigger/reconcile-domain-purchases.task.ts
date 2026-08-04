import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { createDomainReconciliationRuntime } from "./domain-fulfillment.runtime";
import { assertDatabaseConfiguration } from "./domain-operations.config";
import { domainOperationsQueue } from "./domain-task-queues";

/** DB-driven backstop for lost, canceled, and terminal purchase handoffs. */
export const reconcileDomainPurchasesTask = schedules.task({
	id: "reconcile-domain-purchases",
	cron: { pattern: "*/15 * * * *", timezone: "UTC" },
	queue: domainOperationsQueue,
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
			const runtime = createDomainReconciliationRuntime(db);
			const result = await runtime.reconciler.execute();

			logger.info("Domain purchase reconciliation completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
