/**
 * Trigger.dev queues for the app-builder sandbox tasks.
 * `sandbox-idle-sweep.task.ts` consumes `sandboxMaintenanceQueue`;
 * `delete-app-project.task.ts` consumes `appProjectCleanupQueue` — its
 * per-project runs may overlap, unlike the single-scan sweep.
 * `capture-project-thumbnail.task.ts` consumes `projectThumbnailQueue`.
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

/**
 * One thumbnail capture per project at a time. The scheduler sets
 * `concurrencyKey: projectId`, so the captures of one project run in commit
 * order and the newest commit writes last.
 */
// LIMIT: no global cap across projects; each run waits on one exec in its own sandbox. Upgrade: a global queue limit.
export const projectThumbnailQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "project-thumbnail",
});
