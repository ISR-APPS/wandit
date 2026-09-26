/**
 * Trigger.dev queue for the `mobile-build` task (WANDIT-194).
 * `mobile-build.task.ts` consumes `mobileBuildQueue`. The API starter sets
 * `concurrencyKey: projectId`, so each project gets its own queue instance
 * with this limit. The live index on `mobile_builds` guards the same rule.
 */
import { type Queue, queue } from "@trigger.dev/sdk";

/** One build per project at a time; the starter's `concurrencyKey` scopes it. */
// LIMIT: no global cap across projects; EAS queues the extra builds. Upgrade: a global queue limit.
export const mobileBuildQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "mobile-builds",
});
