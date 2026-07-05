import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
	instances: [] as FakeRedisInstance[],
}));

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

vi.mock("ioredis", () => {
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

describe("ChatEventsRepository", () => {
	beforeEach(() => {
		redisMocks.instances.length = 0;
	});

	it("reserves the active generation key with NX semantics", async () => {
		const repository = new ChatEventsRepository();

		await expect(repository.reserveActive("chat_1", "job_1")).resolves.toBe(
			true,
		);
		await expect(repository.reserveActive("chat_1", "job_2")).resolves.toBe(
			false,
		);
	});

	it("does not release another job's active generation flag", async () => {
		const repository = new ChatEventsRepository();
		const redis = redisMocks.instances[0];
		const key = chatEventRedisKeys.active("chat_1");

		await repository.reserveActive("chat_1", "job_2");

		await expect(repository.releaseActive("chat_1", "job_1")).resolves.toBe(
			false,
		);
		expect(redis?.store.get(key)).toBe("job_2");

		await expect(repository.releaseActive("chat_1", "job_2")).resolves.toBe(
			true,
		);
		expect(redis?.store.has(key)).toBe(false);
	});
});
