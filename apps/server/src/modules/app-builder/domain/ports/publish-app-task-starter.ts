/**
 * Port: starts the `publish-app` Trigger.dev task (WANDIT-178).
 * `publish.service.ts` calls it in the API process. The implementation
 * lives in `infrastructure/trigger/` so the task value (and its
 * worker-side imports) never enters the Nest bundle.
 */

/** Nest token for the `PublishAppTaskStarter` implementation. */
export const PUBLISH_APP_TASK_STARTER = Symbol.for(
	"app-builder.publish-app-task-starter",
);

/** The task payload. The task re-reads the `app_builds` row for the rest. */
export type PublishAppTaskInput = {
	/** `app_builds.id`. Also the idempotency key of the trigger call. */
	buildId: string;
	/**
	 * Project of the build. The concurrency key of the run, so one project
	 * runs one publish at a time. The task checks it against the row.
	 */
	projectId: string;
};

/** Queues one `publish-app` run. A retry with the same `buildId` starts no second run. */
export interface PublishAppTaskStarter {
	/** Returns the Trigger.dev run id the API stores on the build row. */
	start(input: PublishAppTaskInput): Promise<{ runId: string }>;
}
