/**
 * Scheduled task: every 2 minutes, end the Trigger.dev builder turns whose
 * run died (crash, OOM, maxDuration, expired ttl), and promote stranded
 * `waiting` rows. The Trigger scheduler calls it; the work lives in
 * `reconcile-builder-turns.runtime.ts` so a spec can run it on fakes.
 */
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { meteringMaintenanceQueue } from "./billing-task-queues";
import { createReconcileBuilderTurnsRuntime } from "./reconcile-builder-turns.runtime";

/**
 * Cron entry; `retry.maxAttempts: 1` because the next tick retries anyway.
 * The queue has concurrency 1, so two sweeps never overlap.
 */
export const reconcileBuilderTurnsTask = schedules.task({
	id: "reconcile-builder-turns",
	cron: { pattern: "*/2 * * * *", timezone: "UTC" },
	// 100 s: ends before the next 2-minute tick.
	maxDuration: 100,
	queue: meteringMaintenanceQueue,
	retry: { maxAttempts: 1 },
	// 1 minute: a tick that waits behind another maintenance run expires,
	// so the ticks never pile up in the shared queue.
	ttl: "1m",
	run: async (_payload, { ctx }) => {
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			const runtime = createReconcileBuilderTurnsRuntime(db, logger);
			try {
				const result = await runtime.run();
				logger.info("Builder turn reconcile completed", {
					...result,
					triggerRunId: ctx.run.id,
				});
				return result;
			} finally {
				await runtime.close();
			}
		} finally {
			await db.$client.end();
		}
	},
});
