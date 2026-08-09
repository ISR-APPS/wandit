import { logger, schedules, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { z } from "zod";

import { assertBillingFinancialConfiguration } from "./billing-maintenance.config";
import { createBillingWebhookRuntime } from "./billing-maintenance.runtime";
import { billingFinancialQueue } from "./billing-task-queues";
import { triggerAnalytics } from "./init";

export const billingWebhookRetrySweepTask = schedules.task({
	id: "billing-webhook-dead-letter-retry-sweep",
	cron: { pattern: "*/10 * * * *", timezone: "UTC" },
	maxDuration: 240,
	queue: billingFinancialQueue,
	retry: { maxAttempts: 1 },
	ttl: "9m",
	run: async (payload, { ctx }) => {
		const result = await runWithRuntime((runtime) =>
			runtime.retry.sweep(payload.timestamp),
		);

		logger.info("Billing webhook dead-letter retry sweep completed", {
			...result,
			triggerRunId: ctx.run.id,
		});

		return result;
	},
});

/** On-demand admin replay; one durable run per event-attempt idempotency key. */
export const billingWebhookRetryEventTask = schemaTask({
	id: "billing-webhook-retry-event",
	maxDuration: 240,
	queue: billingFinancialQueue,
	retry: { maxAttempts: 1 },
	schema: z.object({ eventId: z.string().min(1) }),
	run: async ({ eventId }, { ctx }) => {
		const result = await runWithRuntime((runtime) =>
			runtime.retry.retryEvent(eventId),
		);

		logger.info("Billing webhook event retry completed", {
			...result,
			triggerRunId: ctx.run.id,
		});

		return result;
	},
});

async function runWithRuntime<T>(
	operation: (
		runtime: ReturnType<typeof createBillingWebhookRuntime>,
	) => Promise<T>,
): Promise<T> {
	assertBillingFinancialConfiguration();
	const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

	try {
		return await operation(createBillingWebhookRuntime(db, triggerAnalytics));
	} finally {
		await db.$client.end();
	}
}
