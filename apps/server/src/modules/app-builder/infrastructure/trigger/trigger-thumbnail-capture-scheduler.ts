/**
 * Queues the `capture-project-thumbnail` task on the Trigger.dev management API.
 * `runBuilderTurn` calls it through `deps.scheduleThumbnail` after a succeeded turn that made a commit.
 * It queues the task by its id string. The task value is never imported here:
 * it would pull the worker code into the caller bundle.
 */
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";

import type { SandboxLogger } from "../../domain/ports/sandbox-provider";

/** The task slug that `capture-project-thumbnail.task.ts` registers. */
export const CAPTURE_PROJECT_THUMBNAIL_TASK_ID = "capture-project-thumbnail";

// A successful run keeps its key 1 h, so one commit queues one capture.
// Trigger frees the key of a failed run.
const THUMBNAIL_CAPTURE_IDEMPOTENCY_TTL = "1h";

/** Queues one capture per project and commit. One attempt: the next committed turn captures again. */
export class TriggerThumbnailCaptureScheduler {
	constructor(
		/** The process logger of the turn path. The Trigger Sentry client drops `Sentry.logger` lines. */
		private readonly logger: Pick<SandboxLogger, "warn">,
	) {}

	/**
	 * Never throws: the turn already ended, and a lost capture only keeps the
	 * older thumbnail. A failure logs a warning with the project and the commit.
	 */
	async schedule(projectId: string, commitSha: string): Promise<void> {
		try {
			if (!env.TRIGGER_SECRET_KEY) {
				this.logger.warn("project-thumbnail.schedule-skipped", {
					commitSha,
					projectId,
					reason: "TRIGGER_SECRET_KEY is not set",
				});
				return;
			}
			// A global key: inside the builder-turn run, a plain key would be
			// scoped to that run.
			const idempotencyKey = await idempotencyKeys.create(
				`${CAPTURE_PROJECT_THUMBNAIL_TASK_ID}:${projectId}:${commitSha}`,
				{ scope: "global" },
			);
			await tasks.trigger(
				CAPTURE_PROJECT_THUMBNAIL_TASK_ID,
				{ commitSha, projectId },
				{
					// The task queue has a limit of 1 per key: the captures of one
					// project run in commit order, so the newest commit writes last.
					concurrencyKey: projectId,
					idempotencyKey,
					idempotencyKeyTTL: THUMBNAIL_CAPTURE_IDEMPOTENCY_TTL,
					tags: [`project:${projectId}`],
				},
			);
		} catch (error) {
			this.logger.warn("project-thumbnail.schedule-failed", {
				commitSha,
				error: getErrorMessage(error),
				projectId,
			});
		}
	}
}
