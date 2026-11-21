/**
 * Sweep runtime: ends Trigger.dev builder turns whose run died, then
 * promotes the `waiting` rows of projects with no active row.
 * `reconcile-builder-turns.task.ts` calls it every 2 minutes; the spec calls
 * `runReconcileBuilderTurns` with fakes. `endLostTurn` does the cleanup.
 */
import { runs } from "@trigger.dev/sdk";
import type { createDb } from "@wandit/db";

import { TurnPromoter } from "../modules/app-builder/application/services/turn-promotion";
import type { TurnLock } from "../modules/app-builder/domain/ports/turn-lock";
import { createTurnTaskStarter } from "../modules/app-builder/infrastructure/host/routing-turn-task-starter";
import {
	type BuilderTurnRow,
	BuilderTurnsRepository,
} from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import { LlmSpendCounters } from "../modules/app-builder/infrastructure/redis/llm-spend-counters";
import { RedisTurnLock } from "../modules/app-builder/infrastructure/redis/redis-turn-lock";
import { TriggerTurnTaskStarter } from "../modules/app-builder/infrastructure/trigger/trigger-turn-task-starter";
import { ChatsRepository } from "../modules/generation/infrastructure/persistence/chats.repository";

import type { BuilderTurnLogger } from "./builder-turn.runtime";
import { endLostTurn, type LostTurnDeps, type TurnLoss } from "./end-lost-turn";
import { createTriggerMetering } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;

/**
 * 3 min: a newer row can still get its run id, or its run can still claim it.
 * A run that became final more recently can still run its own cleanup.
 */
export const SWEEP_MIN_AGE_MS = 3 * 60_000;

/**
 * 26 min: one minute past the 25 min `ttl` of `builder-turn`, and shorter
 * than the 30 min lock TTL. A run queued longer has no lock left to use.
 */
export const QUEUE_WAIT_MAX_MS = 26 * 60_000;

const RUN_LOST_ERROR =
	"The build stopped unexpectedly. Send your message again.";
const QUEUE_BUSY_ERROR = "The build queue is busy. Send your message again.";

/** The fields of a Trigger.dev run (`runs.retrieve`) that the sweep reads. */
export type TriggerRunState = Pick<
	Awaited<ReturnType<typeof runs.retrieve>>,
	"createdAt" | "finishedAt" | "isCompleted" | "isQueued" | "status"
>;

/** What the sweep reads and writes; the spec passes fakes. */
export type ReconcileBuilderTurnsDeps = Omit<
	LostTurnDeps,
	"appendEvents" | "lock" | "promoteNext" | "turns"
> & {
	turns: Pick<
		BuilderTurnsRepository,
		"findProjectsWithStrandedWaiting" | "findTriggerOwnedActive" | "transition"
	>;
	/** The project lock. `holder` tells a handoff in progress from a lost row. */
	lock: Pick<TurnLock, "holder" | "release">;
	/** `runs.retrieve` of the Trigger SDK. A throw skips the row for this tick. */
	retrieveRun: (runId: string) => Promise<TriggerRunState>;
	/** `TurnPromoter.promoteNext`. A stranded project has no ended turn. */
	promoteNext: (projectId: string, endedTurnId?: string) => Promise<void>;
	now: () => Date;
};

/** Counts of one sweep, for the task log. */
export type ReconcileBuilderTurnsResult = {
	/** Rows that `endLostTurn` moved to `failed` or `canceled`. */
	ended: number;
	/** Rows with a live run, or rows another writer ended first. */
	skipped: number;
	/** Rows whose run read or cleanup threw; the next tick reads them again. */
	failed: number;
	/** Projects with a stranded `waiting` row that the sweep asked to promote. */
	strandedProjects: number;
};

/**
 * Ends each Trigger-owned active turn whose run is final, or whose run waits
 * in the queue past `QUEUE_WAIT_MAX_MS`. Then promotes stranded queues.
 * The CAS in `endLostTurn` makes a second sweep, or a racing run end, a no-op.
 */
export async function runReconcileBuilderTurns(
	deps: ReconcileBuilderTurnsDeps,
): Promise<ReconcileBuilderTurnsResult> {
	const now = deps.now();
	const olderThan = new Date(now.getTime() - SWEEP_MIN_AGE_MS);
	const result: ReconcileBuilderTurnsResult = {
		ended: 0,
		failed: 0,
		skipped: 0,
		strandedProjects: 0,
	};
	for (const row of await deps.turns.findTriggerOwnedActive(olderThan)) {
		try {
			const loss = await lossOf(deps, row, now);
			const ended =
				loss !== null &&
				(await endLostTurn({ ...deps, appendEvents: null }, row, loss));
			if (ended) {
				result.ended += 1;
			} else {
				result.skipped += 1;
			}
		} catch (error) {
			// An unknown run state never ends a row; the next tick reads it again.
			deps.logger.warn("reconcile.builder-turn.failed", {
				message: error instanceof Error ? error.message : String(error),
				turnId: row.id,
			});
			result.failed += 1;
		}
	}
	for (const projectId of await deps.turns.findProjectsWithStrandedWaiting(
		olderThan,
	)) {
		try {
			await deps.promoteNext(projectId);
			result.strandedProjects += 1;
		} catch (error) {
			// One project must not stop the others; the next tick tries again.
			deps.logger.warn("reconcile.builder-turn.promote-failed", {
				message: error instanceof Error ? error.message : String(error),
				projectId,
			});
			result.failed += 1;
		}
	}
	return result;
}

/** Why the row is lost, or null while a run or a handoff can still own it. */
async function lossOf(
	deps: ReconcileBuilderTurnsDeps,
	row: BuilderTurnRow,
	now: Date,
): Promise<TurnLoss | null> {
	const runId = row.triggerRunId;
	if (runId === null) {
		// The API and the promoter hold the lock under the row id while they
		// queue the run. A row without its lock has no live handoff.
		// The promoter flips the row before it takes the lock. A sweep in that
		// gap of a few ms ends the row, and the lock TTL frees the project.
		if ((await deps.lock.holder(row.projectId)) === row.id) {
			return null;
		}
		return { code: "run_lost", message: RUN_LOST_ERROR, runId: null };
	}
	const run = await deps.retrieveRun(runId);
	// A canceled run is final at once, but its `onCancel` hook still settles
	// the hold and completes the row for up to 15 s. The sweep waits longer.
	if (
		run.isCompleted &&
		run.finishedAt !== undefined &&
		now.getTime() - run.finishedAt.getTime() < SWEEP_MIN_AGE_MS
	) {
		return null;
	}
	if (run.isCompleted) {
		// The 25 min `ttl` of `builder-turn` expired the run before a worker took it.
		return run.status === "EXPIRED"
			? { code: "queue_busy", message: QUEUE_BUSY_ERROR, runId }
			: { code: "run_lost", message: RUN_LOST_ERROR, runId };
	}
	// A run queued before the `ttl` existed can wait past the lock TTL. Its
	// later claim fails on the row CAS, so it does no work.
	if (
		row.status === "queued" &&
		run.isQueued &&
		now.getTime() - run.createdAt.getTime() >= QUEUE_WAIT_MAX_MS
	) {
		return { code: "queue_busy", message: QUEUE_BUSY_ERROR, runId };
	}
	return null;
}

/**
 * Composes the real repositories, the Redis lock and counters, metering, and
 * the promoter for the Trigger worker. `close` ends the Redis clients; the
 * task ends the pool.
 */
export function createReconcileBuilderTurnsRuntime(
	db: TriggerDatabase,
	logger: BuilderTurnLogger,
) {
	const lock = new RedisTurnLock();
	const counters = new LlmSpendCounters();
	const turns = new BuilderTurnsRepository(db);
	const chats = new ChatsRepository(db);
	const promoter = new TurnPromoter(
		turns,
		lock,
		createTurnTaskStarter(new TriggerTurnTaskStarter(), turns, logger),
	);
	return {
		close: async () => {
			await counters.onModuleDestroy();
			await lock.onModuleDestroy();
		},
		run: () =>
			runReconcileBuilderTurns({
				counters,
				insertAssistantMessage: (input) =>
					chats.insertTurnAssistantMessage(input),
				lock,
				logger,
				metering: createTriggerMetering(db),
				now: () => new Date(),
				promoteNext: async (projectId, endedTurnId) => {
					// The promoted row is the promoter's own bookkeeping.
					await promoter.promoteNext(projectId, endedTurnId);
				},
				retrieveRun: (runId) => runs.retrieve(runId),
				turns,
			}),
	};
}
