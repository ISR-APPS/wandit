import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertBillingFinancialConfiguration } from "./billing-maintenance.config";
import { createSubscriptionRefillRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";

export const subscriptionRefillSweepTask = schedules.task({
	id: "subscription-refill-sweep",
	cron: { pattern: "*/10 * * * *", timezone: "UTC" },
	maxDuration: 240,
	queue: billingFinancialQueue,
	retry: { maxAttempts: 1 },
	ttl: "9m",
	run: async (payload, { ctx }) => {
		assertBillingFinancialConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createSubscriptionRefillRuntime(db);
			// Each grant is an independent CAS-claimed transaction, so a large batch
			// is safe; 1,000 per 10-minute run keeps post-outage backlogs draining
			// at least as fast as the retired 100/minute worker sweep.
			const result = await runtime.refills.sweepDueSlots(
				payload.timestamp,
				1_000,
			);

			logger.info("Subscription refill sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
