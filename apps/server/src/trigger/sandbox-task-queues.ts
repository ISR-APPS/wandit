/**
 * Trigger.dev queues for the app-builder sandbox tasks.
 * `sandbox-idle-sweep.task.ts` consumes `sandboxMaintenanceQueue`;
 * `delete-app-project.task.ts` consumes `appProjectCleanupQueue` — its
 * per-project runs may overlap, unlike the single-scan sweep.
 */
import { type Queue, queue } from "@trigger.dev/sdk";

/** One idle-sweep run at a time; the next cron tick covers a skipped run. */
export const sandboxMaintenanceQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "sandbox-maintenance",
});

// Its own queue at 2: a delete must not wait behind a 4-minute sweep on the maintenance queue.
export const appProjectCleanupQueue: Queue = queue({
	concurrencyLimit: 2,
	name: "app-project-cleanup",
});
