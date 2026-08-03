import { logger, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { z } from "zod";

import { assertBillingFinancialConfiguration } from "./billing-maintenance.config";
import { createAffiliateMaintenanceRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";

export const affiliateAttributionRetryTask = schemaTask({
	id: "affiliate-attribution-retry",
	maxDuration: 300,
	queue: billingFinancialQueue,
	retry: {
		factor: 2,
		maxAttempts: 12,
		// Preserve the retired BullMQ retry horizon: 12 exponential 60-second
		// attempts span roughly 34 hours, covering signup/DB deployment outages.
		maxTimeoutInMs: 24 * 60 * 60_000,
		minTimeoutInMs: 60_000,
		randomize: false,
	},
	schema: z.object({
		source: z.enum(["signup_body", "signup_cookie"]),
		token: z.string().min(1).max(4_096),
		userId: z.string().min(1),
	}),
	run: async (payload, { ctx }) => {
		assertBillingFinancialConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createAffiliateMaintenanceRuntime(db);
			const result = await runtime.attribution.retryLock(payload);

			logger.info("Affiliate attribution retry completed", {
				attributed: result !== null,
				triggerRunId: ctx.run.id,
				userId: payload.userId,
			});

			return { attributed: result !== null };
		} finally {
			await db.$client.end();
		}
	},
});
