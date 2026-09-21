/**
 * Handoff port for the `provision-backend` Trigger.dev task.
 * `BackendsService.provisionBackend` calls it after the `app_backends`
 * row is written; `TriggerProvisionBackendTaskStarter` implements it
 * from the API process.
 */
/** Nest token carrying the starter. */
export const PROVISION_BACKEND_TASK_STARTER = Symbol.for(
	"app-builder.provision-backend-task-starter",
);

/** Payload of one `provision-backend` run. */
export type ProvisionBackendTaskInput = {
	/** Project whose `app_backends` row the task loads. */
	projectId: string;
	/** Dedupe key written on the row; also the run's idempotency key. */
	requestKey: string;
};

/** Starts the task; a retry with the same `requestKey` starts no second run. */
export interface ProvisionBackendTaskStarter {
	start(input: ProvisionBackendTaskInput): Promise<{ runId: string }>;
}
