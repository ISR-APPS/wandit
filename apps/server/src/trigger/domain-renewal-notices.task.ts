import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { createDomainRenewalRuntime } from "./domain-fulfillment.runtime";
import { assertDatabaseConfiguration } from "./domain-operations.config";
import { domainOperationsQueue } from "./domain-task-queues";

/** Daily T-30 notice sweep. This task never charges or renews a domain. */
export const domainRenewalNoticesTask = schedules.task({
	id: "domain-renewal-notices",
	cron: { pattern: "0 2 * * *", timezone: "UTC" },
	queue: domainOperationsQueue,
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 1_000,
		randomize: false,
	},
	run: async (_payload, { ctx }) => {
		assertDatabaseConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createDomainRenewalRuntime(db);
			const result = await runtime.renewalNotices.execute();

			logger.info("Domain renewal notice sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
