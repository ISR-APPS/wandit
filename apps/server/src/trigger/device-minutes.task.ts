/**
 * Scheduled task: every 5 minutes, bill the ended Appetize device sessions
 * (WANDIT-196). The Trigger scheduler calls it; the work lives in
 * `device-minutes.runtime.ts` so a spec can run it on fakes.
 */
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { meteringMaintenanceQueue } from "./billing-task-queues";
import { createDeviceMinutesRuntime } from "./device-minutes.runtime";

/** Cron entry; `retry.maxAttempts: 1` — the next tick retries anyway. */
export const deviceMinutesTask = schedules.task({
	id: "device-minutes",
	cron: { pattern: "*/5 * * * *", timezone: "UTC" },
	// 240 s: ends before the next 5-minute tick.
	maxDuration: 240,
	// Concurrency 1: two runs never bill the same page at the same time.
	queue: meteringMaintenanceQueue,
	retry: { maxAttempts: 1 },
	// 4 minutes: a stale schedule expires before the next tick fires.
	ttl: "4m",
	run: async (_payload, { ctx }) => {
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const runtime = createDeviceMinutesRuntime(db);
		try {
			const result = await runtime.run();
			logger.info("Device minutes billed", {
				...result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await db.$client.end();
		}
	},
});
