/**
 * In-memory `TurnLock` for domain and application specs.
 * No Redis: entries live in a Map. They expire against a clock the spec
 * controls, so TTL and contention cases run without sleep.
 */
import type { TurnLock } from "../../domain/ports/turn-lock";

type FakeLockEntry = {
	/** `builder_turns` id holding the lock. */
	turnId: string;
	/** Milliseconds on the injected clock after which the entry is free. */
	expiresAt: number;
};

/**
 * `TurnLock` fake with the same compare-and-expire rules as the Redis
 * contract: an expired entry behaves as absent for every method.
 */
export class FakeTurnLock implements TurnLock {
	private readonly entries = new Map<string, FakeLockEntry>();

	constructor(private readonly now: () => number = Date.now) {}

	async acquire(
		projectId: string,
		turnId: string,
		ttlMs: number,
	): Promise<boolean> {
		if (this.liveEntry(projectId)) {
			return false;
		}
		this.entries.set(projectId, {
			expiresAt: this.now() + ttlMs,
			turnId,
		});
		return true;
	}

	async refresh(
		projectId: string,
		turnId: string,
		ttlMs: number,
	): Promise<boolean> {
		const entry = this.liveEntry(projectId);
		if (!entry || entry.turnId !== turnId) {
			return false;
		}
		entry.expiresAt = this.now() + ttlMs;
		return true;
	}

	async release(projectId: string, turnId: string): Promise<boolean> {
		const entry = this.liveEntry(projectId);
		if (!entry || entry.turnId !== turnId) {
			return false;
		}
		this.entries.delete(projectId);
		return true;
	}

	async holder(projectId: string): Promise<string | null> {
		return this.liveEntry(projectId)?.turnId ?? null;
	}

	private liveEntry(projectId: string): FakeLockEntry | undefined {
		const entry = this.entries.get(projectId);
		if (!entry) {
			return undefined;
		}
		if (entry.expiresAt <= this.now()) {
			this.entries.delete(projectId);
			return undefined;
		}
		return entry;
	}
}
