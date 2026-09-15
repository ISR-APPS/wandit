/**
 * Trigger.dev queue for the `builder-turn` task.
 * One run per project at a time. The starter sets `concurrencyKey:
 * projectId`, so each project gets its own queue instance with this
 * limit. The Redis turn lock and `builder_turns` guard the same rule.
 */
import { type Queue, queue } from "@trigger.dev/sdk";

/** One run per project at a time; the starter's `concurrencyKey` scopes it. */
export const builderTurnQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "builder-turn",
});
