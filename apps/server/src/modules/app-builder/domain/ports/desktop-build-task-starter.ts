/**
 * Port: starts the `desktop-build` Trigger.dev task (docs/v2/desktop-apps.md
 * section 9). `desktop-builds.service.ts` calls it in the API process. The
 * implementation lives in `infrastructure/trigger/`, so the task value and
 * its worker imports never enter the Nest bundle.
 */
/** Nest token for the `DesktopBuildTaskStarter` implementation. */
export const DESKTOP_BUILD_TASK_STARTER = Symbol.for(
	"app-builder.desktop-build-task-starter",
);

/**
 * The task payload. Kept small: the task reads the `desktop_builds` and
 * `desktop_apps` rows for the commit, the names, and the keys.
 */
export type DesktopBuildTaskInput = {
	/** `desktop_builds.id`. Also the idempotency key of the trigger call. */
	buildId: string;
	/**
	 * Project of the build. The concurrency key of the run, so one project
	 * runs one build at a time. The task checks it against the row.
	 */
	projectId: string;
};

/**
 * Queues one `desktop-build` run. A retry with the same `buildId` starts no
 * second run. A cancel needs no run cancel: the task reads the row at each
 * step and stops when the API moved it to `canceled`.
 */
export interface DesktopBuildTaskStarter {
	/** Returns the Trigger.dev run id that the API stores on the build row. */
	start(input: DesktopBuildTaskInput): Promise<{ runId: string }>;
}
