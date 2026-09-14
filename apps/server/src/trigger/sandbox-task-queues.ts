/**
 * Trigger.dev queues for the app-builder sandbox maintenance tasks.
 * `sandbox-idle-sweep.task.ts` consumes `sandboxMaintenanceQueue`; later
 * sandbox chores join the same queue so one maintenance run owns the
 * `sandbox_sessions` scan at a time.
 */
import { type Queue, queue } from "@trigger.dev/sdk";

/** One idle-sweep run at a time; the next cron tick covers a skipped run. */
export const sandboxMaintenanceQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "sandbox-maintenance",
});
