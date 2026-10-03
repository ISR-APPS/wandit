/**
 * In-memory `LlmSpendCounterStore` for specs.
 * Mirrors the Redis semantics: integer micro counters, per-key expiry, and
 * a fixed one-minute rate window that starts on the first hit.
 */

import type { LlmProxyChatBinding } from "@wandit/contracts";

import {
	type LlmRequestAdmission,
	type LlmRequestToken,
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
	// Chat id → the turn the chat runs now; the TTL is not modeled.
	readonly chats = new Map<string, LlmProxyChatBinding>();

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

	admitRequest(
		token: LlmRequestToken,
		dayKey: string,
	): Promise<LlmRequestAdmission> {
		// Like the Redis script: a bound chat moves the request to its turn.
		const binding =
			token.chatId === null ? undefined : this.chats.get(token.chatId);
		const runId = binding?.runId ?? token.runId;
		const userId = binding?.userId ?? token.userId;
		this.add(llmSpendRedisKeys.inFlight(runId), 1, 15 * 60_000);
		return Promise.resolve({
			binding: binding ?? null,
			rateHits: this.hitRunRate(runId),
			revoked: this.revoked.has(runId),
			runSpendMicros: this.read(llmSpendRedisKeys.run(runId)),
			userSpendMicros: this.read(llmSpendRedisKeys.user(userId, dayKey)),
		});
	}

	finishRequest(runId: string): Promise<void> {
		this.add(llmSpendRedisKeys.inFlight(runId), -1, 15 * 60_000);
		return Promise.resolve();
	}

	readInFlight(runId: string): Promise<number> {
		return Promise.resolve(this.read(llmSpendRedisKeys.inFlight(runId)));
	}

	bindChat(
		chatId: string,
		binding: LlmProxyChatBinding,
		_ttlSeconds: number,
	): Promise<void> {
		this.chats.set(chatId, binding);
		return Promise.resolve();
	}

	unbindChat(chatId: string, turnId: string): Promise<void> {
		if (this.chats.get(chatId)?.turnId === turnId) {
			this.chats.delete(chatId);
		}
		return Promise.resolve();
	}

	revokeRun(runId: string, _ttlSeconds: number): Promise<void> {
		this.revoked.add(runId);
		return Promise.resolve();
	}

	// A fixed one-minute window that starts at the first hit.
	private hitRunRate(runId: string): number {
		const key = llmSpendRedisKeys.runRate(runId);
		const existing = this.entries.get(key);
		if (existing !== undefined && existing.expiresAt <= this.now()) {
			this.entries.delete(key);
		}
		const entry = this.entries.get(key);
		if (entry === undefined) {
			this.entries.set(key, { value: 1, expiresAt: this.now() + 60_000 });
			return 1;
		}
		entry.value += 1;
		return entry.value;
	}

	// `amount` is USD micros on a spend key and a request count on the
	// in-flight key; a negative amount ends one in-flight request.
	private add(key: string, amount: number, ttlMs: number): number {
		const existing = this.entries.get(key);
		if (existing !== undefined && existing.expiresAt <= this.now()) {
			this.entries.delete(key);
		}
		const entry = this.entries.get(key) ?? {
			value: 0,
			expiresAt: this.now() + ttlMs,
		};
		entry.value += amount;
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
