/**
 * Port: starts the `mobile-build` Trigger.dev task (WANDIT-194).
 * `mobile-builds.service.ts` calls it in the API process. The
 * implementation lives in `infrastructure/trigger/` so the task value (and
 * its worker-side imports) never enters the Nest bundle.
 */
/** Nest token for the `MobileBuildTaskStarter` implementation. */
export const MOBILE_BUILD_TASK_STARTER = Symbol.for(
	"app-builder.mobile-build-task-starter",
);

/**
 * Everything the task payload carries. Kept small: the task re-reads the
 * `mobile_builds` row for the commit and the owner pair.
 */
export type MobileBuildTaskInput = {
	/** `mobile_builds.id`. Also the idempotency key of the trigger call. */
	buildId: string;
	/**
	 * Project of the build. The concurrency key of the run, so one project
	 * runs one build at a time. The task checks it against the row.
	 */
	projectId: string;
	/**
	 * `actorIsLimitExempt` of the org scope; false in a personal scope. The
	 * task rebuilds the metering subject of the credit hold with it.
	 */
	actorIsLimitExempt: boolean;
};

/**
 * Queues one `mobile-build` run. A retry with the same `buildId` starts no
 * second run. Cancel needs no run cancel: the task reads the row on each
 * poll and stops when the API has moved it to `canceled`.
 */
export interface MobileBuildTaskStarter {
	/** Returns the Trigger.dev run id the API stores on the build row. */
	start(input: MobileBuildTaskInput): Promise<{ runId: string }>;
}
