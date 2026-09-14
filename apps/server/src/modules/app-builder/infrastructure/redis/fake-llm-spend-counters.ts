/**
 * In-memory `LlmSpendCounterStore` for specs.
 * Mirrors the Redis semantics: integer micro counters, per-key expiry, and
 * a fixed one-minute rate window that starts on the first hit.
 */

import {
	type LlmSpendCounterStore,
	llmSpendRedisKeys,
} from "./llm-spend-counters";

type FakeEntry = {
	value: number;
	// Epoch milliseconds after which reads and hits see nothing.
	expiresAt: number;
};

/** Spec-friendly spend counters; the clock is injectable for TTL tests. */
export class FakeLlmSpendCounters implements LlmSpendCounterStore {
	private readonly entries = new Map<string, FakeEntry>();
	// Run ids passed to `revokeRun`; specs assert membership after a call.
	readonly revoked = new Set<string>();

	constructor(private readonly now: () => number = Date.now) {}

	addRunSpend(
		runId: string,
		usdMicros: number,
		ttlSeconds: number,
	): Promise<number> {
		return Promise.resolve(
			this.add(llmSpendRedisKeys.run(runId), usdMicros, ttlSeconds * 1000),
		);
	}

	addUserSpend(
		userId: string,
		dayKey: string,
		usdMicros: number,
	): Promise<number> {
		return Promise.resolve(
			this.add(
				llmSpendRedisKeys.user(userId, dayKey),
				usdMicros,
				48 * 60 * 60 * 1000,
			),
		);
	}

	readRunSpend(runId: string): Promise<number> {
		return Promise.resolve(this.read(llmSpendRedisKeys.run(runId)));
	}

	readUserSpend(userId: string, dayKey: string): Promise<number> {
		return Promise.resolve(this.read(llmSpendRedisKeys.user(userId, dayKey)));
	}

	hitRunRateLimit(runId: string): Promise<number> {
		const key = llmSpendRedisKeys.runRate(runId);
		const existing = this.entries.get(key);
		if (existing !== undefined && existing.expiresAt <= this.now()) {
			this.entries.delete(key);
		}
		const entry = this.entries.get(key);
		if (entry === undefined) {
			this.entries.set(key, { value: 1, expiresAt: this.now() + 60_000 });
			return Promise.resolve(1);
		}
		entry.value += 1;
		return Promise.resolve(entry.value);
	}

	revokeRun(runId: string, _ttlSeconds: number): Promise<void> {
		this.revoked.add(runId);
		return Promise.resolve();
	}

	isRunRevoked(runId: string): Promise<boolean> {
		return Promise.resolve(this.revoked.has(runId));
	}

	private add(key: string, usdMicros: number, ttlMs: number): number {
		const existing = this.entries.get(key);
		if (existing !== undefined && existing.expiresAt <= this.now()) {
			this.entries.delete(key);
		}
		const entry = this.entries.get(key) ?? {
			value: 0,
			expiresAt: this.now() + ttlMs,
		};
		entry.value += usdMicros;
		entry.expiresAt = this.now() + ttlMs;
		this.entries.set(key, entry);
		return entry.value;
	}

	private read(key: string): number {
		const entry = this.entries.get(key);
		if (entry === undefined || entry.expiresAt <= this.now()) {
			return 0;
		}
		return entry.value;
	}
}
