import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { lifecycleEventsQueue } from "./lifecycle-events.queue";
import { createLifecycleEventsRuntime } from "./lifecycle-events.runtime";

export const lifecycleEventsSweepTask = schedules.task({
	id: "lifecycle-events-sweep",
	cron: { pattern: "*/5 * * * *", timezone: "UTC" },
	maxDuration: 240,
	queue: lifecycleEventsQueue,
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 30_000,
		minTimeoutInMs: 5_000,
		randomize: false,
	},
	ttl: "4m",
	run: async (_payload, { ctx }) => {
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const result = await createLifecycleEventsRuntime(db).dispatcher.sweep();
			logger.info("Lifecycle events sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await db.$client.end();
		}
	},
});
