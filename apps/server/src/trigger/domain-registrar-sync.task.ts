import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { createDomainRegistrarSyncRuntime } from "./domain-fulfillment.runtime";
import { assertDomainRegistrarSyncConfiguration } from "./domain-operations.config";
import { domainOperationsQueue } from "./domain-task-queues";

/** Weekly Name.com expiry, transfer-lock, and ownership reconciliation. */
export const domainRegistrarSyncTask = schedules.task({
	id: "domain-registrar-sync",
	cron: { pattern: "0 3 * * 0", timezone: "UTC" },
	queue: domainOperationsQueue,
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 1_000,
		randomize: false,
	},
	run: async (_payload, { ctx }) => {
		assertDomainRegistrarSyncConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createDomainRegistrarSyncRuntime(db);
			const result = await runtime.registrarSync.execute();

			logger.info("Domain registrar sync completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
