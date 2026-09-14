/**
 * Port: starts and cancels the `builder-turn` Trigger.dev task.
 * `turns.service.ts` and `turn-promotion.ts` call it in the API process.
 * The implementation lives in `infrastructure/trigger/` so the task value
 * (and its worker-side imports) never enters the Nest bundle.
 */
/** Nest token for the `TurnTaskStarter` implementation. */
export const TURN_TASK_STARTER = Symbol.for("app-builder.turn-task-starter");

/** Everything the task payload carries. Kept small: the task re-reads the
 * turn row and the session row for the real state. */
export type TurnTaskStartInput = {
	/** `builder_turns` id. Also the idempotency key of the trigger call. */
	turnId: string;
	projectId: string;
	/** The user whose submit queued the turn; recorded for audit. */
	actorUserId: string;
	/** Set for org-scoped projects, else null. */
	organizationId: string | null;
};

/**
 * Queue a `builder-turn` run and cancel one. `start` is idempotent on
 * `turnId`; `cancel` is best-effort — the durable row decides the outcome.
 */
export interface TurnTaskStarter {
	/** Returns the Trigger.dev run id the API stores on the turn row. */
	start(input: TurnTaskStartInput): Promise<{ runId: string }>;
	cancel(runId: string): Promise<void>;
}
