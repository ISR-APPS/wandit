/**
 * Scheduled task: every hour, email the manual subscriptions (SlickPay, offline) whose period ends in the next 3 days.
 * The Trigger scheduler calls it. The work lives in SubscriptionRenewalRemindersService,
 * built by createSubscriptionRenewalRemindersRuntime on a fresh database pool.
 */
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertBillingDatabaseConfiguration } from "./billing-maintenance.config";
import { createSubscriptionRenewalRemindersRuntime } from "./billing-maintenance.runtime";

/** Hourly reminder sweep. It throws when a row failed; that row goes out on the next run. */
export const subscriptionRenewalRemindersTask = schedules.task({
	id: "subscription-renewal-reminders",
	// Hourly: the email lands close to 3 days before the date. A failed send tries
	// again the next hour, inside the 24-hour idempotency window of Resend.
	cron: { pattern: "0 * * * *", timezone: "UTC" },
	// 600 s: far more than one page of 100 sends. A larger backlog continues the next hour.
	maxDuration: 600,
	// Its own queue at 1: two runs never overlap, and an email run never holds
	// a slot of billingFinancialQueue.
	queue: { concurrencyLimit: 1 },
	// 1 attempt: the next hourly run is the retry.
	retry: { maxAttempts: 1 },
	// 50 minutes: a run that cannot start before the next hour is dropped.
	ttl: "50m",
	run: async (payload, { ctx }) => {
		assertBillingDatabaseConfiguration();
		// Fresh pool per run, closed in `finally`, so a reused worker leaks no connection.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createSubscriptionRenewalRemindersRuntime(db);
			const result = await runtime.renewalReminders.execute(payload.timestamp);

			logger.info("Subscription renewal reminders completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
