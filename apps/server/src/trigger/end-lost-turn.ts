/**
 * Ends one builder turn whose run died: the row, the reply, the stream, the
 * hold, the proxy token, the lock, and the queue. Two sweeps call it:
 * `harness-host/recover-host-turns.ts` for host turns and
 * `reconcile-builder-turns.runtime.ts` for Trigger.dev turns.
 */
import { randomUUID } from "node:crypto";
import {
	builderTurnSpecSchema,
	type TurnDoneData,
	type TurnErrorData,
} from "@wandit/contracts";

import { LLM_PROXY_TOKEN_TTL_SECONDS } from "../modules/app-builder/application/services/llm-proxy-token.service";
import type { TurnStreamEventInput } from "../modules/app-builder/domain/ports/turn-events";
import type { TurnLock } from "../modules/app-builder/domain/ports/turn-lock";
import type {
	BuilderTurnRow,
	BuilderTurnsRepository,
} from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import type { LlmSpendCounterStore } from "../modules/app-builder/infrastructure/redis/llm-spend-counters";
import type { MeteringService } from "../modules/metering/application/services/metering.service";

import type {
	BuilderTurnDeps,
	BuilderTurnLogger,
} from "./builder-turn.runtime";

/** What `endLostTurn` reads and writes. Both sweeps pass the builder-turn deps. */
export type LostTurnDeps = {
	turns: Pick<BuilderTurnsRepository, "transition">;
	lock: Pick<TurnLock, "release">;
	counters: Pick<LlmSpendCounterStore, "revokeRun" | "unbindChat">;
	metering: Pick<MeteringService, "findByIdempotencyKeyAnyPayer" | "refund">;
	/** `TurnPromoter.promoteNext`: queues the next waiting turn of the project. */
	promoteNext: (projectId: string, endedTurnId: string) => Promise<void>;
	/**
	 * Stores the reply row of the dead turn, so a reload shows the error card
	 * or the Stopped line.
	 */
	insertAssistantMessage: BuilderTurnDeps["insertAssistantMessage"];
	/**
	 * Appends events after the ones the dead run wrote to the turn's Redis
	 * Stream. Null for a Trigger.dev turn: its stream belongs to the dead run,
	 * and the relay ends the read from the terminal row.
	 */
	appendEvents:
		| ((turnId: string, events: TurnStreamEventInput[]) => Promise<void>)
		| null;
	logger: BuilderTurnLogger;
};

/** Why the run died. The row, the error event, and the reply row carry it. */
export type TurnLoss = {
	/** `failure_code` of the row and `code` of the error event, for example `host_lost`. */
	code: string;
	/** The sentence on the turn card. */
	message: string;
	/** The run id that the proxy token names, or null when no run minted a token. */
	runId: string | null;
};

/**
 * Ends one dead turn. Answers false when the row left the status the sweep
 * read: the writer that moved it owns the cleanup.
 */
export async function endLostTurn(
	deps: LostTurnDeps,
	row: BuilderTurnRow,
	loss: TurnLoss,
): Promise<boolean> {
	// A cancel already asked for the stop, so the turn ends as canceled.
	const canceled = row.status === "cancelling";
	// The CAS names the status the sweep read. A run that pauses on a card or
	// ends at the same moment wins, and this sweep does nothing.
	const ended = canceled
		? await deps.turns.transition(row.id, ["cancelling"], "canceled", {
				completedAt: new Date(),
			})
		: await deps.turns.transition(row.id, [row.status], "failed", {
				completedAt: new Date(),
				error: loss.message,
				failureCode: loss.code,
				failureKind: null,
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: "task",
				sentryEventId: null,
			});
	if (!ended) {
		return false;
	}
	deps.logger.warn("builder-turn.lost-turn-ended", {
		code: loss.code,
		projectId: row.projectId,
		status: row.status,
		turnId: row.id,
	});
	const step = async (name: string, fn: () => Promise<void>) => {
		try {
			await fn();
		} catch (error) {
			// The row is terminal; one failed step must not skip the next ones.
			deps.logger.warn("builder-turn.lost-turn-step-failed", {
				message: error instanceof Error ? error.message : String(error),
				step: name,
				turnId: row.id,
			});
		}
	};
	const done: TurnDoneData = { status: canceled ? "canceled" : "failed" };
	// Retry reads the mode, so a lost `security_scan` turn retries as a scan.
	// A spec that fails the parse leaves it absent: Retry then uses the toggle.
	const spec = builderTurnSpecSchema.pick({ mode: true }).safeParse(row.spec);
	const errorData: TurnErrorData = {
		code: loss.code,
		message: loss.message,
		mode: spec.success ? spec.data.mode : undefined,
		retryable: true,
	};
	// A run stores its reply only at its end, so a dead run left none. The row
	// holds the same part as the stream: a reload shows the error card and
	// Retry, or the Stopped line. It lands before the events, for a reload
	// right after `done`.
	const { chatId } = row;
	if (chatId !== null) {
		await step("reply", () =>
			deps.insertAssistantMessage({
				chatId,
				id: randomUUID(),
				metadata: null,
				parts: canceled
					? [{ data: done, id: "turn-done", type: "data-turn-done" }]
					: [{ data: errorData, id: "turn-error", type: "data-turn-error" }],
				turnId: row.id,
			}),
		);
	}
	const { appendEvents } = deps;
	if (appendEvents !== null) {
		await step("events", () =>
			appendEvents(
				row.id,
				canceled
					? [{ data: done, type: "done" }]
					: [
							{ data: errorData, type: "error" },
							{ data: done, type: "done" },
						],
			),
		);
	}
	// The same rule as a failed or canceled run: the reserved hold goes back,
	// and the checkpoint debits of the work that ran stay paid. The refund
	// returns the credits to the pool that the hold row names.
	await step("refund", async () => {
		const hold = await deps.metering.findByIdempotencyKeyAnyPayer(
			`builder-turn:${row.id}`,
		);
		if (hold?.status === "reserved") {
			await deps.metering.refund(
				hold.id,
				canceled ? "builder_turn_canceled" : "builder_turn_failed",
			);
		}
	});
	// The token and the chat binding die with the turn, so no process in the
	// sandbox can spend after it.
	if (chatId !== null) {
		await step("unbind", () => deps.counters.unbindChat(chatId, row.id));
	}
	const { runId } = loss;
	if (runId !== null) {
		await step("revoke", () =>
			deps.counters.revokeRun(runId, LLM_PROXY_TOKEN_TTL_SECONDS),
		);
	}
	await step("lock", async () => {
		await deps.lock.release(row.projectId, row.id);
	});
	await step("promote", () => deps.promoteNext(row.projectId, row.id));
	return true;
}
