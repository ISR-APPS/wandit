/**
 * `GithubSyncScheduler` on the Trigger.dev management API.
 * `commitTurn` calls it in the API, the builder-turn task, and the harness host; the GitHub routes call it too.
 * It reads the link through `ProjectGithubLinksRepository` and queues the `github-sync` task by its id string.
 * The task value is never imported here: it would pull the worker code into the Nest bundle.
 */
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";

import type { GithubSyncScheduler } from "../../domain/ports/github-sync-scheduler";
import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import type { ProjectGithubLinksRepository } from "../persistence/project-github-links.repository";

/** The task slug that `github-sync.task.ts` registers. */
export const GITHUB_SYNC_TASK_ID = "github-sync";

// A successful run keeps its key 1 h, so one reason queues one run per hour
// at most. Trigger frees the key of a failed run, so the next poll retries.
const GITHUB_SYNC_IDEMPOTENCY_TTL = "1h";

/** Queues one `github-sync` run per project and reason. One attempt: the next commit or poll schedules again. */
export class TriggerGithubSyncScheduler implements GithubSyncScheduler {
	constructor(
		private readonly links: Pick<ProjectGithubLinksRepository, "findByProject">,
		/** `Sentry.logger` in the API; the process logger in the worker, where `Sentry.logger` drops lines. */
		private readonly logger: Pick<SandboxLogger, "warn">,
	) {}

	async scheduleIfLinked(projectId: string, reasonKey: string): Promise<void> {
		try {
			// Most projects have no link: no Trigger run per turn for them.
			if ((await this.links.findByProject(projectId)) === null) {
				return;
			}
			if (!env.TRIGGER_SECRET_KEY) {
				this.logger.warn("github-sync.schedule-skipped", {
					projectId,
					reason: "TRIGGER_SECRET_KEY is not set",
					reasonKey,
				});
				return;
			}
			// A global key: `commitTurn` also runs inside the builder-turn task,
			// where a plain key would be scoped to that run.
			const idempotencyKey = await idempotencyKeys.create(
				`${GITHUB_SYNC_TASK_ID}:${projectId}:${reasonKey}`,
				{ scope: "global" },
			);
			await tasks.trigger(
				GITHUB_SYNC_TASK_ID,
				{ projectId },
				{
					// The task queue has a limit of 1 per key: one sync per project at a time.
					concurrencyKey: projectId,
					idempotencyKey,
					idempotencyKeyTTL: GITHUB_SYNC_IDEMPOTENCY_TTL,
					tags: [`project:${projectId}`],
				},
			);
		} catch (error) {
			// The port never throws: the commit or the route already did its work.
			this.logger.warn("github-sync.schedule-failed", {
				error: getErrorMessage(error),
				projectId,
				reasonKey,
			});
		}
	}
}
