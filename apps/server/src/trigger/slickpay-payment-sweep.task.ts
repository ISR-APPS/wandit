/**
 * Trigger.dev cron that refreshes the open SlickPay payments every 5 minutes.
 * It fulfills the payments of buyers who closed the tab before the return page confirmed them.
 * It calls SlickpayPaymentsService.sweep through createSlickpayRuntime.
 */
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";

import type { SlickpayPaymentSweepResult } from "../modules/billing/application/services/slickpay-payments.service";
import { assertBillingDatabaseConfiguration } from "./billing-maintenance.config";
import { createSlickpayRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";

/** Cron "slickpay-payment-sweep", every 5 min in UTC. Without SLICKPAY_PUBLIC_KEY it opens no database and returns zero counts. */
export const slickpayPaymentSweepTask = schedules.task({
	id: "slickpay-payment-sweep",
	cron: { pattern: "*/5 * * * *", timezone: "UTC" },
	// The SlickPay timeout is 15 s. An outage holds the shared billing queue for at most 2 of every 5 minutes.
	maxDuration: 120,
	queue: billingFinancialQueue,
	retry: { maxAttempts: 1 },
	// The next run starts 5 minutes later, so a run that waited 4 minutes is dropped.
	ttl: "4m",
	run: async (_payload, { ctx }): Promise<SlickpayPaymentSweepResult> => {
		// Without the key, SlickPay is off and the sweep cannot ask SlickPay about any invoice.
		if (env.SLICKPAY_PUBLIC_KEY === undefined) {
			logger.info(
				"SlickPay payment sweep skipped: SLICKPAY_PUBLIC_KEY is not set",
				{
					triggerRunId: ctx.run.id,
				},
			);

			return { checked: 0, errors: 0, fulfilled: 0, stillPaid: 0 };
		}

		assertBillingDatabaseConfiguration();
		const db = createDb({ max: 1 });

		try {
			const result = await createSlickpayRuntime(db).slickpayPayments.sweep();

			logger.info("SlickPay payment sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
