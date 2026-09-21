/**
 * Scheduled task: every 15 minutes, reprice settled `agent_session` events
 * against the `llm_proxy_requests` rows. The Trigger scheduler calls it;
 * the work lives in `reconcile-agent-sessions.runtime.ts` so a spec can
 * run it on fakes.
 */
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import { meteringMaintenanceQueue } from "./billing-task-queues";
import { createReconcileAgentSessionsRuntime } from "./reconcile-agent-sessions.runtime";

/** Cron entry; `retry.maxAttempts: 1` — the next tick retries anyway. */
export const reconcileAgentSessionsTask = schedules.task({
	id: "reconcile-agent-sessions",
	cron: { pattern: "*/15 * * * *", timezone: "UTC" },
	// 240 s: ends before the next 15-minute tick.
	maxDuration: 240,
	queue: meteringMaintenanceQueue,
	retry: { maxAttempts: 1 },
	// 14 minutes: a stale schedule expires before the next tick fires.
	ttl: "14m",
	run: async (_payload, { ctx }) => {
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const runtime = createReconcileAgentSessionsRuntime(db);
		try {
			const result = await runtime.run();
			logger.info("Agent session reconcile completed", {
				...result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await db.$client.end();
		}
	},
});
