/**
 * Scheduled task: every five minutes, stop sandboxes idle for
 * `SANDBOX_IDLE_STOP_MINUTES`. The Trigger scheduler calls it; the work
 * lives in `sandbox-idle-sweep.runtime.ts` so a spec can run it on fakes.
 */
import "./undici-timeouts";
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { createSandboxIdleSweepRuntime } from "./sandbox-idle-sweep.runtime";
import { sandboxMaintenanceQueue } from "./sandbox-task-queues";

/** Cron entry; `retry.maxAttempts: 1` — the next tick retries anyway. */
export const sandboxIdleSweepTask = schedules.task({
	id: "sandbox-idle-sweep",
	cron: { pattern: "*/5 * * * *", timezone: "UTC" },
	// 240 s: ends before the next 5-minute tick.
	maxDuration: 240,
	queue: sandboxMaintenanceQueue,
	retry: { maxAttempts: 1 },
	// 4 minutes: a stale schedule expires before the next tick fires.
	ttl: "4m",
	run: async (_payload, { ctx }) => {
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const runtime = createSandboxIdleSweepRuntime(db);
		try {
			const result = await runtime.sweep();
			logger.info("Sandbox idle sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			// The turn lock holds a Redis client; close it next to the pool.
			await runtime.turnLock.onModuleDestroy();
			await db.$client.end();
		}
	},
});
