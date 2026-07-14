/**
 * Tests for Redis chat event storage.
 *
 * These tests focus on the Redis "busy" flag that prevents two generations in
 * the same chat at the same time.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` runs before imports, so the ioredis mock is ready in time.
const redisMocks = vi.hoisted(() => ({
	instances: [] as FakeRedisInstance[],
}));

// Small fake Redis shape used by these tests.
type FakeRedisInstance = {
	disconnect: () => void;
	eval: (
		script: string,
		keyCount: number,
		key: string,
		expectedValue: string,
	) => Promise<number>;
	get: (key: string) => Promise<string | null>;
	quit: () => Promise<"OK">;
	set: (
		key: string,
		value: string,
		...args: Array<number | string>
	) => Promise<"OK" | null>;
	status: string;
	store: Map<string, string>;
};

// Replace real Redis with an in-memory fake.
vi.mock("ioredis", () => {
	// Fake only the Redis commands used by the repository code under test.
	class FakeRedis implements FakeRedisInstance {
		status = "ready";
		store = new Map<string, string>();

		constructor() {
			redisMocks.instances.push(this);
		}

		disconnect(): void {
			this.status = "end";
		}

		async eval(
			_script: string,
			_keyCount: number,
			key: string,
			expectedValue: string,
		): Promise<number> {
			// Delete only if the stored job id matches.
			if (this.store.get(key) !== expectedValue) {
				return 0;
			}

			this.store.delete(key);
			return 1;
		}

		async get(key: string): Promise<string | null> {
			return this.store.get(key) ?? null;
		}

		async quit(): Promise<"OK"> {
			this.status = "end";
			return "OK";
		}

		async set(
			key: string,
			value: string,
			...args: Array<number | string>
		): Promise<"OK" | null> {
			// NX means "set only if the key does not exist".
			if (args.includes("NX") && this.store.has(key)) {
				return null;
			}

			this.store.set(key, value);
			return "OK";
		}
	}

	return { default: FakeRedis };
});

import {
	ChatEventsRepository,
	chatEventRedisKeys,
} from "./chat-events.repository";

// Check the Redis busy-flag behavior.
describe("ChatEventsRepository", () => {
	// Reset fake Redis instances before each test.
	beforeEach(() => {
		redisMocks.instances.length = 0;
	});

	// First job reserves; second job is rejected.
	it("reserves the active generation key with NX semantics", async () => {
		const repository = new ChatEventsRepository();

		await expect(repository.reserveActive("chat_1", "job_1")).resolves.toBe(
			true,
		);
		await expect(repository.reserveActive("chat_1", "job_2")).resolves.toBe(
			false,
		);
	});

	// A job cannot release a busy flag owned by another job.
	it("does not release another job's active generation flag", async () => {
		const repository = new ChatEventsRepository();
		// Inspect the fake Redis state.
		const redis = redisMocks.instances[0];
		const key = chatEventRedisKeys.active("chat_1");

		await repository.reserveActive("chat_1", "job_2");

		// job_1 did not create the lock, so it cannot delete it.
		await expect(repository.releaseActive("chat_1", "job_1")).resolves.toBe(
			false,
		);
		expect(redis?.store.get(key)).toBe("job_2");

		// The owning job can release the lock.
		await expect(repository.releaseActive("chat_1", "job_2")).resolves.toBe(
			true,
		);
		expect(redis?.store.has(key)).toBe(false);
	});
});
