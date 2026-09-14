/**
 * Promotes the oldest `waiting` turn of a project to `queued` and starts
 * its `builder-turn` run. Three callers: the cancel path in
 * `turns.service.ts`, the relay `done` handler, and the end of the
 * `builder-turn` task (WANDIT-166 constructs this class directly — it is a
 * plain class with constructor dependencies, not a Nest-only provider).
 */
import { Logger } from "@nestjs/common";
import type { TurnLock } from "../../domain/ports/turn-lock";
import type { TurnTaskStarter } from "../../domain/ports/turn-task-starter";
import type {
	BuilderTurnRow,
	BuilderTurnsRepository,
} from "../../infrastructure/persistence/builder-turns.repository";
import { TURN_LOCK_TTL_MS } from "../../infrastructure/redis/redis-turn-lock";

/**
 * The three repository methods promotion needs. A `Pick` keeps the
 * constructor narrow: the task (WANDIT-166) and specs can pass a small
 * fake without casting, and the full repository still satisfies it.
 */
export type TurnsRepositoryForPromotion = Pick<
	BuilderTurnsRepository,
	"promoteOldestWaiting" | "setTriggerRunId" | "transition"
>;

export class TurnPromoter {
	private readonly logger = new Logger(TurnPromoter.name);

	constructor(
		private readonly turns: TurnsRepositoryForPromotion,
		private readonly lock: TurnLock,
		private readonly starter: TurnTaskStarter,
	) {}

	/**
	 * Flips the oldest waiting row to `queued`, takes the project lock under
	 * the promoted turn id, and triggers the task. Returns the promoted row,
	 * or null when nothing waits or the slot/lock stayed taken. A lock
	 * acquire failure or a failed handoff reverts the row to `waiting` so a
	 * later promote call can retry it.
	 */
	async promoteNext(
		projectId: string,
		/** The turn that just ended. The compare-delete frees only that
		 * turn's lock. A newer holder stays untouched, so the acquire
		 * cannot wait on the TTL. */
		endedTurnId?: string,
	): Promise<BuilderTurnRow | null> {
		if (endedTurnId !== undefined) {
			await this.lock.release(projectId, endedTurnId);
		}

		const waiting = await this.turns.promoteOldestWaiting(projectId);
		if (!waiting) {
			return null;
		}

		// The flipped row already holds the active slot; the lock must move to
		// the same turn id before the task starts, or a stale lock holder could
		// keep refreshing under its old id.
		const acquired = await this.lock.acquire(
			projectId,
			waiting.id,
			TURN_LOCK_TTL_MS,
		);
		if (!acquired) {
			await this.revertToWaiting(waiting.id);
			return null;
		}

		try {
			const { runId } = await this.starter.start({
				actorUserId: waiting.userId,
				organizationId: waiting.organizationId,
				projectId,
				turnId: waiting.id,
			});
			await this.turns.setTriggerRunId(waiting.id, runId);
			return waiting;
		} catch (error) {
			this.logger.warn(
				`Builder turn handoff failed for ${waiting.id}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			try {
				await this.revertToWaiting(waiting.id);
			} finally {
				// The lock must leave even when the revert write fails; the TTL
				// is the last guard.
				await this.lock.release(projectId, waiting.id);
			}
			return null;
		}
	}

	/** CAS `queued` → `waiting`: a no-op when the row already moved on. */
	private async revertToWaiting(turnId: string): Promise<void> {
		await this.turns.transition(turnId, ["queued"], "waiting");
	}
}
