/**
 * Port: queues one `github-sync` worker run for a project that has a GitHub link.
 * `commitTurn` calls it after each move of the `main` head. The project GitHub
 * routes call it after a link, a pull, a webhook push, and a status check that sees new heads.
 * `TriggerGithubSyncScheduler` in `infrastructure/trigger` implements it.
 */

/** Nest token for the `GithubSyncScheduler` implementation. */
export const GITHUB_SYNC_SCHEDULER = Symbol.for(
	"app-builder.github-sync-scheduler",
);

/** Schedules the reconcile run of the GitHub sync. */
export interface GithubSyncScheduler {
	/**
	 * Does nothing for a project without a link. Never throws: a failed
	 * schedule logs a warning with the project and the reason, and the next
	 * commit or status poll schedules again. `reasonKey` is part of the
	 * idempotency key, for example `push:<sha>` or `state:<head>:<github>`, so
	 * the same reason queues one run per hour at most.
	 */
	scheduleIfLinked(projectId: string, reasonKey: string): Promise<void>;
}
