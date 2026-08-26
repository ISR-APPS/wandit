/**
 * Rewrites attached Google Sheets every 30 minutes, but only for projects
 * whose leads changed. The cadence keeps exports fresh without spending the
 * per-user Sheets write quota on unchanged projects.
 */
import { logger, schedules } from "@trigger.dev/sdk";
import { LEAD_SHEET_AUTO_SYNC_INTERVAL_MINUTES } from "@wandit/contracts";
import { createDb } from "@wandit/db";

import { assertDatabaseConfiguration } from "./domain-operations.config";
import { createLeadSheetAutoSyncRuntime } from "./lead-sheet-sync.runtime";
import { leadSheetAutoSyncQueue } from "./lead-task-queues";

export const leadSheetAutoSyncTask = schedules.task({
	id: "lead-sheet-auto-sync",
	cron: {
		pattern: `*/${LEAD_SHEET_AUTO_SYNC_INTERVAL_MINUTES} * * * *`,
		timezone: "UTC",
	},
	maxDuration: 1500,
	queue: leadSheetAutoSyncQueue,
	ttl: "25m",
	run: async (_payload, { ctx }) => {
		assertDatabaseConfiguration();
		// Advisory locks use dedicated connections, so the task's sync queries only
		// need a single pooled client.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const runtime = createLeadSheetAutoSyncRuntime(db);
			const summary = await runtime.autoSync.sweep({
				// Leave ten minutes before maxDuration for the final in-flight rewrite.
				budgetMs: 15 * 60_000,
			});
			const { failures, ...counts } = summary;

			logger.info("Lead sheet auto-sync sweep completed", {
				...counts,
				triggerRunId: ctx.run.id,
			});

			for (const failure of failures) {
				logger.warn("Lead sheet auto-sync project failed", {
					...failure,
					triggerRunId: ctx.run.id,
				});
			}

			// One user's token failure usually means that merchant revoked the grant;
			// several users failing with nothing synced points to a misconfigured
			// Trigger environment (for example, a secret/client mismatch).
			if (
				summary.failed > 0 ||
				(summary.synced === 0 && summary.tokenFailedUsers >= 2)
			) {
				throw new Error(
					`Lead sheet auto-sync left ${summary.failed} project(s) unsynced and ${summary.tokenFailed} token mint(s) failed across ${summary.tokenFailedUsers} user(s)`,
				);
			}

			return summary;
		} finally {
			await db.$client.end();
		}
	},
});
