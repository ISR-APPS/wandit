/**
 * Crash recovery of the harness host. A host crash leaves its turns active:
 * the unique index blocks every new build of the project, the lock stays,
 * and the credit hold stays reserved. `main.ts` calls `recoverHostTurns` at
 * start and on a timer; it ends those turns like a failed run does.
 */
import { LLM_PROXY_TOKEN_TTL_SECONDS } from "../modules/app-builder/application/services/llm-proxy-token.service";
import type { TurnStreamEventInput } from "../modules/app-builder/domain/ports/turn-events";
import type { TurnLock } from "../modules/app-builder/domain/ports/turn-lock";
import { hostRunIdOf } from "../modules/app-builder/domain/turn-queue";
import type {
	BuilderTurnRow,
	BuilderTurnsRepository,
} from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import type { LlmSpendCounterStore } from "../modules/app-builder/infrastructure/redis/llm-spend-counters";
import type { MeteringService } from "../modules/metering/application/services/metering.service";
import type { BuilderTurnLogger } from "../trigger/builder-turn.runtime";

/** The error the turn card shows after a host crash. */
const HOST_LOST_ERROR = "The build server restarted. Send your message again.";

/** What the recovery reads and writes; `main.ts` passes the host deps. */
export type HostRecoveryDeps = {
	turns: Pick<
		BuilderTurnsRepository,
		"fail" | "findHostOwnedActive" | "transition"
	>;
	lock: Pick<TurnLock, "release">;
	counters: Pick<LlmSpendCounterStore, "revokeRun" | "unbindChat">;
	metering: Pick<MeteringService, "findByIdempotencyKey" | "refund">;
	/** `TurnPromoter.promoteNext`: queues the next waiting turn of the project. */
	promoteNext: (projectId: string, endedTurnId: string) => Promise<void>;
	/** Appends events after the ones the dead run wrote to the turn's Redis Stream. */
	appendEvents: (
		turnId: string,
		events: TurnStreamEventInput[],
	) => Promise<void>;
	logger: BuilderTurnLogger;
};

// LIMIT: one host instance. A turn that another instance runs looks dead
// here. Upgrade: a host instance id on the row, or a Redis lease per turn.
/**
 * Ends every host-owned active turn that no run of this process owns. A
 * `queued` row ends only on its second sweep: the API may hand it over now.
 * Answers the ids of the `queued` rows this sweep saw first, for the next call.
 */
export async function recoverHostTurns(
	deps: HostRecoveryDeps,
	/** `HostTurnRunner.liveTurnIds()` at the sweep start. */
	liveTurnIds: ReadonlySet<string>,
	/** The answer of the previous sweep; empty at the host start. */
	queuedSeenBefore: ReadonlySet<string>,
): Promise<Set<string>> {
	const queuedSeenNow = new Set<string>();
	for (const row of await deps.turns.findHostOwnedActive()) {
		if (liveTurnIds.has(row.id)) {
			continue;
		}
		if (row.status === "queued" && !queuedSeenBefore.has(row.id)) {
			queuedSeenNow.add(row.id);
			continue;
		}
		await recoverTurn(deps, row);
	}
	return queuedSeenNow;
}

/** Ends one dead turn: the row, the stream, the hold, the token, the lock, the queue. */
async function recoverTurn(
	deps: HostRecoveryDeps,
	row: BuilderTurnRow,
): Promise<void> {
	// A cancel already asked for the stop, so the turn ends as canceled.
	const canceled = row.status === "cancelling";
	const ended = canceled
		? await deps.turns.transition(row.id, ["cancelling"], "canceled", {
				completedAt: new Date(),
			})
		: await deps.turns.fail(row.id, {
				error: HOST_LOST_ERROR,
				failureCode: "host_lost",
				failureKind: null,
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: "task",
				sentryEventId: null,
			});
	// A false CAS: the row ended under us, and its writer owns the cleanup.
	if (!ended) {
		return;
	}
	deps.logger.warn("harness-host.turn-recovered", {
		projectId: row.projectId,
		status: row.status,
		turnId: row.id,
	});
	const step = async (name: string, fn: () => Promise<void>) => {
		try {
			await fn();
		} catch (error) {
			// The row is terminal; one failed step must not skip the next ones.
			deps.logger.warn("harness-host.recovery-step-failed", {
				message: error instanceof Error ? error.message : String(error),
				step: name,
				turnId: row.id,
			});
		}
	};
	await step("events", () =>
		deps.appendEvents(
			row.id,
			canceled
				? [{ data: { status: "canceled" }, type: "done" }]
				: [
						{
							data: {
								code: "host_lost",
								message: HOST_LOST_ERROR,
								retryable: true,
							},
							type: "error",
						},
						{ data: { status: "failed" }, type: "done" },
					],
		),
	);
	// The same rule as a failed or canceled run: the reserved hold goes back,
	// and the checkpoint debits of the work that ran stay paid.
	await step("refund", async () => {
		const hold = await deps.metering.findByIdempotencyKey(
			`builder-turn:${row.id}`,
			{ actorUserId: row.userId, organizationId: row.organizationId },
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
	const { chatId } = row;
	if (chatId !== null) {
		await step("unbind", () => deps.counters.unbindChat(chatId, row.id));
	}
	await step("revoke", () =>
		deps.counters.revokeRun(hostRunIdOf(row.id), LLM_PROXY_TOKEN_TTL_SECONDS),
	);
	await step("lock", async () => {
		await deps.lock.release(row.projectId, row.id);
	});
	await step("promote", () => deps.promoteNext(row.projectId, row.id));
}
