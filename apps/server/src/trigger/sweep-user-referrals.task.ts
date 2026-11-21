/**
 * Trigger.dev schedule `user-referral-sweep`: each 5 minutes, it runs one sweep of the user referral program.
 * Trigger.dev calls it from the cron. It calls `UserReferralsService.runSweep` with one task database pool.
 */
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertBillingDatabaseConfiguration } from "./billing-maintenance.config";
import { createUserReferralRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";

/**
 * Marks first payments and activations, then delivers each due referral reward.
 * A failed step makes the run red. The next run tries the same rows again, and each grant is idempotent.
 */
export const userReferralSweepTask = schedules.task({
	id: "user-referral-sweep",
	cron: { pattern: "*/5 * * * *", timezone: "UTC" },
	// 240 s and a 4-minute ttl: a run ends, or expires in the queue, before the next cron tick.
	maxDuration: 240,
	// The queue runs one financial task at a time, so two sweeps never run together.
	queue: billingFinancialQueue,
	// A retry is safe: each grant has an idempotency key, and a set mark or stamp stays unchanged.
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 30_000,
		minTimeoutInMs: 5_000,
		randomize: false,
	},
	ttl: "4m",
	run: async (_payload, { ctx }) => {
		assertBillingDatabaseConfiguration();
		// One connection is sufficient: the sweep sends its queries one at a time.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createUserReferralRuntime(db);
			const result = await runtime.userReferrals.runSweep(new Date());

			logger.info("User referral sweep completed", {
				activated: result.activated,
				delivered: result.delivered,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
