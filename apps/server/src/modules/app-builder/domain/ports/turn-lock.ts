/**
 * Port: the per-project turn lock that serializes builder turns.
 * The API sets and releases the Redis key `builder:lock:{projectId}`;
 * the running task only refreshes it. WANDIT-167 implements it on Redis.
 */

/** Nest token for the `TurnLock` implementation. */
export const TURN_LOCK = Symbol.for("app-builder.turn-lock");

/**
 * Mutual exclusion for turns of one project. All methods key on
 * `projectId`; the stored value is the holding `turnId`.
 */
export interface TurnLock {
	/** `SET builder:lock:{projectId} turnId NX PX ttlMs`. False when held. */
	acquire(projectId: string, turnId: string, ttlMs: number): Promise<boolean>;
	/** `PEXPIRE` only when the stored turn id matches. */
	refresh(projectId: string, turnId: string, ttlMs: number): Promise<boolean>;
	/** Compare-and-delete: removes the key only for the holding turn. */
	release(projectId: string, turnId: string): Promise<boolean>;
	/** The holding turn id, or null when the lock is free or expired. */
	holder(projectId: string): Promise<string | null>;
}
