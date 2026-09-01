import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { createExternalDomainDelegationRemindersRuntime } from "./domain-fulfillment.runtime";
import { assertDatabaseConfiguration } from "./domain-operations.config";
import { domainOperationsQueue } from "./domain-task-queues";

/** Daily sweep for external domains that still need registrar delegation. */
export const externalDomainDelegationRemindersTask = schedules.task({
	id: "external-domain-delegation-reminders",
	cron: { pattern: "30 2 * * *", timezone: "UTC" },
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
			const runtime = createExternalDomainDelegationRemindersRuntime(db);
			const result = await runtime.delegationReminders.execute();

			logger.info("External domain delegation reminder sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
