/**
 * Trigger.dev queue for the `publish-app` task (WANDIT-178).
 * `publish-app.task.ts` consumes `publishAppQueue`. The API starter sets
 * `concurrencyKey: projectId`, so each project gets its own queue instance
 * with this limit. The live index on `app_builds` guards the same rule.
 */
import { type Queue, queue } from "@trigger.dev/sdk";

/** One publish per project at a time; the starter's `concurrencyKey` scopes it. */
// LIMIT: no global cap across projects; each run holds one sandbox build. Upgrade: a global queue limit.
export const publishAppQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "publish-app",
});
