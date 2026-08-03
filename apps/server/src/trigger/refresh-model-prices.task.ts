import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { assertBillingDatabaseConfiguration } from "./billing-maintenance.config";
import { createModelPriceRefreshRuntime } from "./billing-maintenance.runtime";
import { modelPricingQueue } from "./billing-task-queues";

export const modelPriceRefreshTask = schedules.task({
	id: "model-price-refresh",
	cron: { pattern: "0 * * * *", timezone: "UTC" },
	maxDuration: 120,
	queue: modelPricingQueue,
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	ttl: "59m",
	run: async (_payload, { ctx }) => {
		assertBillingDatabaseConfiguration();
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createModelPriceRefreshRuntime(db);
			const result = await runtime.modelPricing.refreshFromGateway();

			logger.info("Model price refresh completed", {
				...result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
