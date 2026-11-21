/**
 * Crash recovery of the harness host. A host crash leaves its turns active:
 * the unique index blocks every new build of the project, the lock stays,
 * and the credit hold stays reserved. `main.ts` calls `recoverHostTurns` at
 * start and on a timer; `endLostTurn` ends those turns like a failed run does.
 */
import { hostRunIdOf } from "../modules/app-builder/domain/turn-queue";
import type { BuilderTurnsRepository } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import { endLostTurn, type LostTurnDeps } from "../trigger/end-lost-turn";

/** The error the turn card shows after a host crash. */
const HOST_LOST_ERROR = "The build server restarted. Send your message again.";

/** What the recovery reads and writes; `main.ts` passes the host deps. */
export type HostRecoveryDeps = Omit<LostTurnDeps, "turns"> & {
	turns: Pick<BuilderTurnsRepository, "findHostOwnedActive" | "transition">;
	/**
	 * True while some host instance runs the turn: the run mark that its runner
	 * refreshes in Redis has not expired yet. `main.ts` reads the mark.
	 */
	isRunningOnAnyHost: (turnId: string) => Promise<boolean>;
};

/**
 * Ends every host-owned active turn that no host instance runs. A
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
		// In a deploy, the old instance still runs its turns while the new one
		// sweeps. Their run marks keep them out of this recovery.
		if (await deps.isRunningOnAnyHost(row.id)) {
			continue;
		}
		await endLostTurn(deps, row, {
			code: "host_lost",
			message: HOST_LOST_ERROR,
			runId: hostRunIdOf(row.id),
		});
	}
	return queuedSeenNow;
}
