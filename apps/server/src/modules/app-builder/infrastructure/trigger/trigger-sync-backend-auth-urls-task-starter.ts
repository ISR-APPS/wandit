/**
 * `ProjectDomainHook` and `ProjectNameHook` on the Trigger.dev management
 * API (WANDIT-190). The domains module calls it after a custom domain of a
 * V2 app goes live, goes away, or becomes primary. The `publish-app` task
 * calls it after the flip, and `PublishService` after an unpublish.
 * `ProjectsService` calls it after a rename of a V2 app. It queues
 * `sync-backend-auth-urls`, which writes the published URLs into the
 * Supabase auth config and keeps the From name of the sign-up code email.
 * The task id string is the only coupling: the task value is never imported
 * here (it would pull the worker code into Nest).
 */
import { tasks } from "@trigger.dev/sdk";

import type { ProjectDomainHook } from "../../../domains/domain/ports/project-domain-hook.port";
import type { ProjectNameHook } from "../../../projects/domain/ports/project-name-hook.port";

/** The task slug that `sync-backend-auth-urls.task.ts` registers. */
export const SYNC_BACKEND_AUTH_URLS_TASK_ID = "sync-backend-auth-urls";

export class TriggerSyncBackendAuthUrlsTaskStarter
	implements ProjectDomainHook, ProjectNameHook
{
	/**
	 * Queues one sync run. No idempotency key: every domain change must sync
	 * again, and the sync reads the full state, so a second run is a no-op.
	 * The concurrency key runs the syncs of one project one at a time, so an
	 * older run never writes last.
	 */
	async onProjectDomainsChanged(projectId: string): Promise<void> {
		await tasks.trigger(
			SYNC_BACKEND_AUTH_URLS_TASK_ID,
			{ projectId },
			{ concurrencyKey: projectId, tags: [`project:${projectId}`] },
		);
	}

	/**
	 * Queues the same sync run after a rename: the run also writes the From
	 * name of the sign-up code email, which is the project name.
	 */
	onProjectNameChanged(projectId: string): Promise<void> {
		return this.onProjectDomainsChanged(projectId);
	}
}
