/**
 * Pure turn-state helpers shared by the API and the builder-turn task.
 * `turns.service.ts` calls them in the API process; the `builder-turn`
 * Trigger.dev task calls them inside the run. No I/O and no Nest imports,
 * so both sides can use them without a container.
 */
import type { BuilderTurnStatus } from "@wandit/contracts";

/**
 * Statuses whose row holds the project's single active slot (the
 * `builder_turns_active_project_uq` partial unique index). `waiting` is
 * outside on purpose: parked queue rows never take the slot.
 */
export const PROJECT_ACTIVE_TURN_STATUSES: readonly BuilderTurnStatus[] = [
	"queued",
	"running",
	"cancelling",
];

/**
 * Statuses whose answer can still stream: the active slot plus `waiting`.
 * The chat history filter hides their assistant rows. A turn paused on a
 * question or an approval is not here: its stream ended and its row holds
 * the open card, so a reload must show it.
 */
export const CHAT_ACTIVE_TURN_STATUSES: readonly BuilderTurnStatus[] = [
	"queued",
	"waiting",
	"running",
	"cancelling",
];

/** Statuses after which no write is legal again. */
export const TERMINAL_TURN_STATUSES: readonly BuilderTurnStatus[] = [
	"succeeded",
	"failed",
	"canceled",
	"stalled",
	"stopped_no_credits",
	"stopped_project_cap",
	"stopped_disabled",
];

/**
 * Statuses the cancel flow may interrupt with `cancelling`. `waiting` is
 * excluded on purpose: a parked turn has no run and no lock, so it goes
 * straight to `canceled`. The paused `waiting_for_*` states also skip
 * `cancelling`: the pause ended the run already.
 */
export const CANCELLABLE_TURN_STATUSES: readonly BuilderTurnStatus[] = [
	"queued",
	"running",
];

/**
 * Lock-holder prefix a restore writes instead of a turn id
 * (`versions.service.ts`). `turns.service.ts` reads `holder` when the
 * lock is busy without a row. This prefix means a restore runs, so the
 * submit gets a 409 instead of parking forever.
 */
export const RESTORE_LOCK_HOLDER_PREFIX = "restore:";

/** True while the turn can still change state. Inverse of the terminal set. */
export function isActiveStatus(status: BuilderTurnStatus): boolean {
	return !isTerminalStatus(status);
}

/** True once the turn is in a state no legal write can leave. */
export function isTerminalStatus(status: BuilderTurnStatus): boolean {
	return (TERMINAL_TURN_STATUSES as readonly string[]).includes(status);
}

/**
 * Where a cancel sends a turn. `waiting` and the paused `waiting_for_*`
 * states go straight to `canceled`: no run is alive. Active statuses go
 * through `cancelling` so the task can write its wip commit.
 * `cancelling` stays for an idempotent retry. Terminal rows answer
 * `null` because cancel is a no-op there.
 */
export function nextStatusForCancel(
	status: BuilderTurnStatus,
): BuilderTurnStatus | null {
	if (
		status === "waiting" ||
		status === "waiting_for_answer" ||
		status === "waiting_for_approval"
	) {
		return "canceled";
	}

	if (status === "cancelling") {
		return "cancelling";
	}

	return isTerminalStatus(status) ? null : "cancelling";
}

/**
 * Fencing error: a task tried to write while a newer turn owns the
 * project. `turnNumber` only grows per project, so a stale write always
 * carries a lower number than the current holder.
 */
export class StaleTurnError extends Error {
	readonly code = "BUILDER_TURN_STALE";

	constructor(
		/** The turn number that currently owns the project. */
		readonly current: number,
		/** The turn number the stale writer presented. */
		readonly turnNumber: number,
	) {
		super(`Builder turn ${turnNumber} is stale; current turn is ${current}`);
		this.name = "StaleTurnError";
	}
}

/**
 * Fence check the task runs before each write (issue: fencing). Throws
 * `StaleTurnError` when the writing turn is older than the project state.
 */
export function assertCurrentTurn(current: number, turnNumber: number): void {
	if (turnNumber < current) {
		throw new StaleTurnError(current, turnNumber);
	}
}
