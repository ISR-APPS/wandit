/**
 * Port: starts and cancels one builder turn run, on the harness host or on
 * the `builder-turn` Trigger.dev task. `turns.service.ts` and
 * `turn-promotion.ts` call it in the API, the task, and the host. The
 * Trigger implementation lives in `infrastructure/trigger/`, so the task
 * value (and its worker-side imports) never enters the Nest bundle.
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
	/**
	 * ms from the HTTP request start to the turn row insert, for the
	 * `builder-turn.timing` line. Null for a promoted turn: no request waits.
	 */
	apiCreateMs: number | null;
};

/**
 * Start a turn run on one path and cancel one. `start` is idempotent on
 * `turnId`; `cancel` is best-effort — the durable row decides the outcome.
 */
export interface TurnTaskStarter {
	/**
	 * Starts the run on one path and names it. Only one path can claim the
	 * row (the claim CAS reads `runner`), so a start is safe to retry.
	 */
	start(input: TurnTaskStartInput): Promise<TurnRunHandle>;
	/** Best-effort stop of a running turn; the durable row decides the outcome. */
	cancel(turnId: string, handle: TurnRunHandle): Promise<void>;
}

/**
 * Where a started turn runs. `trigger`: a Trigger.dev run; the API stores
 * `runId` on the row. `host`: the harness host process; the row says
 * `runner = host` and holds no run id.
 */
export type TurnRunHandle =
	| { runner: "trigger"; runId: string }
	| { runner: "host" };
