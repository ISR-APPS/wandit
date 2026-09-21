/**
 * Handoff port for the `delete-app-project` Trigger.dev task.
 * `ProjectsService.delete` calls it after a `v2_app` row soft-deletes;
 * `TriggerDeleteAppProjectTaskStarter` implements it from the API process.
 */
/** Nest token carrying the starter; null when V2 is off at boot. */
export const DELETE_APP_PROJECT_TASK_STARTER = Symbol.for(
	"app-builder.delete-app-project-task-starter",
);

/** Payload of one `delete-app-project` run. */
export type DeleteAppProjectInput = {
	/** Soft-deleted project row id; also the run's idempotency anchor. */
	projectId: string;
	/** User who asked for the delete; lands on the audit row and event. */
	actorUserId: string;
	/** Org workspace the project belongs to; null for a personal scope. */
	organizationId: string | null;
};

/** Starts the cleanup task; a retry on the same projectId is a no-op. */
export interface DeleteAppProjectTaskStarter {
	start(input: DeleteAppProjectInput): Promise<{ runId: string }>;
}
