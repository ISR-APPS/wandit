import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertBillingDatabaseConfiguration } from "./billing-maintenance.config";
import { createManualBillingRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";

export const manualSubscriptionExpiryTask = schedules.task({
	id: "manual-subscription-expiry",
	cron: { pattern: "*/10 * * * *", timezone: "UTC" },
	maxDuration: 240,
	queue: billingFinancialQueue,
	retry: { maxAttempts: 1 },
	ttl: "9m",
	run: async (payload, { ctx }) => {
		assertBillingDatabaseConfiguration();
		const db = createDb({ max: 1 });

		try {
			const runtime = createManualBillingRuntime(db);
			const result = await runtime.manualSubscriptions.expireDue(
				payload.timestamp,
				500,
			);

			logger.info("Manual subscription expiry sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
