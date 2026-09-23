/**
 * Scheduled task: once a day, delete the Workers for Platforms user
 * Workers whose project is gone or soft-deleted. The Trigger scheduler
 * calls it; the work lives in `w4p-orphan-sweep.runtime.ts` so a spec can
 * run it on fakes. It catches a Worker that `delete-app-project` missed.
 */
import "./undici-timeouts";
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { createW4pOrphanSweepRuntime } from "./w4p-orphan-sweep.runtime";

/** Daily cron entry; `retry.maxAttempts: 1` — the next day retries anyway. */
export const w4pOrphanSweepTask = schedules.task({
	id: "w4p-orphan-sweep",
	// 04:00 UTC: a quiet hour, after the deletes of the day.
	cron: { pattern: "0 4 * * *", timezone: "UTC" },
	// 900 s: 50 deletes take about a minute at normal speed. In a Cloudflare
	// outage one delete can take 165 s (5 timeouts of 30 s plus the backoff),
	// so the run stops at 900 s and the next day continues.
	maxDuration: 900,
	// Its own queue at 1: a slow run never takes a slot of the idle sweep
	// or of the project-delete queue, and two runs never overlap.
	queue: { concurrencyLimit: 1 },
	retry: { maxAttempts: 1 },
	// 1 hour: a run that cannot start in that time waits for the next day.
	ttl: "1h",
	run: async (_payload, { ctx }) => {
		// Fresh pool per run; ended in `finally` so the worker process can be
		// reused without leaking Postgres connections.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			const result = await createW4pOrphanSweepRuntime(
				db,
				ctx.environment.type,
			).sweep();
			logger.info("W4P orphan sweep completed", {
				...result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await db.$client.end();
		}
	},
});
