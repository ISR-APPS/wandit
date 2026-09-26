/**
 * Scheduled task: once a day, pause the Supabase projects of idle
 * backends and delete the ones of deleted projects after the grace window
 * (WANDIT-184). The Trigger scheduler calls it; the work lives in
 * `backend-pause-sweep.runtime.ts` so a spec can run it on fakes.
 */
import "./undici-timeouts";
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { createBackendPauseSweepRuntime } from "./backend-pause-sweep.runtime";

/** Daily cron entry; `retry.maxAttempts: 1` — the next day retries anyway. */
export const backendPauseSweepTask = schedules.task({
	id: "backend-pause-sweep",
	// 03:00 UTC: a quiet hour, and a free slot before the 04:00 W4P sweep.
	cron: { pattern: "0 3 * * *", timezone: "UTC" },
	// 900 s: four steps of at most 50 rows take a few minutes at normal
	// speed. In a Supabase outage one call can take 165 s (5 timeouts of
	// 30 s plus the backoff), so the run stops at 900 s and the next day
	// continues.
	maxDuration: 900,
	// Its own queue at 1: a slow run never takes a slot of the provisioning
	// queue that project creation uses, and two runs never overlap.
	queue: { concurrencyLimit: 1 },
	retry: { maxAttempts: 1 },
	// 1 hour: a run that cannot start in that time waits for the next day.
	ttl: "1h",
	run: async (_payload, { ctx }) => {
		// Fresh pool per run; ended in `finally` so the worker process can be
		// reused without leaking Postgres connections.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const runtime = createBackendPauseSweepRuntime(db, ctx.environment.type);
		try {
			const result = await runtime.sweep();
			logger.info("Backend pause sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			// The rate limiter holds a Redis client; close it next to the pool.
			await runtime.close();
			await db.$client.end();
		}
	},
});
