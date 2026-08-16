import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
	constructorOptions: [] as unknown[],
	del: vi.fn<(key: string) => Promise<number>>(),
	disconnect: vi.fn<() => void>(),
	eval: vi.fn<
		(
			script: string,
			keyCount: number,
			key: string,
			ttl: number,
		) => Promise<unknown>
	>(),
	get: vi.fn<(key: string) => Promise<string | null>>(),
	initialStatus: "ready",
	on: vi.fn<(event: string, listener: (error: Error) => void) => void>(),
	quit: vi.fn<() => Promise<"OK">>(),
	set: vi.fn<
		(
			key: string,
			value: string,
			...args: Array<number | string>
		) => Promise<"OK">
	>(),
}));

vi.mock("ioredis", () => ({
	default: class FakeRedis {
		status: string;

		constructor(options: unknown) {
			this.status = redisMocks.initialStatus;
			redisMocks.constructorOptions.push(options);
		}

		del(key: string): Promise<number> {
			return redisMocks.del(key);
		}

		disconnect(): void {
			this.status = "end";
			redisMocks.disconnect();
		}

		eval(
			script: string,
			keyCount: number,
			key: string,
			ttl: number,
		): Promise<unknown> {
			return redisMocks.eval(script, keyCount, key, ttl);
		}

		get(key: string): Promise<string | null> {
			return redisMocks.get(key);
		}

		on(event: string, listener: (error: Error) => void): this {
			redisMocks.on(event, listener);
			return this;
		}

		async quit(): Promise<"OK"> {
			this.status = "end";
			return redisMocks.quit();
		}

		set(
			key: string,
			value: string,
			...args: Array<number | string>
		): Promise<"OK"> {
			return redisMocks.set(key, value, ...args);
		}
	},
}));

import {
	BetterAuthRedisSecondaryStorage,
	createFailOpenRateLimitSecondaryStorage,
	type RateLimitSecondaryStorageBackend,
} from "./better-auth-redis-secondary-storage";

const RATE_LIMIT_KEY = "203.0.113.10|/sign-in/email";
const NAMESPACED_RATE_LIMIT_KEY =
	"better-auth:rate-limit:203.0.113.10|/sign-in/email";

function createBackend(): RateLimitSecondaryStorageBackend {
	return {
		delete: vi.fn(async () => undefined),
		get: vi.fn(async () => "stored"),
		increment: vi.fn(async () => 2),
		set: vi.fn(async () => undefined),
	};
}

describe("createFailOpenRateLimitSecondaryStorage", () => {
	beforeEach(() => {
		redisMocks.constructorOptions.length = 0;
		redisMocks.initialStatus = "ready";
		redisMocks.del.mockReset().mockResolvedValue(1);
		redisMocks.disconnect.mockReset();
		redisMocks.eval.mockReset().mockResolvedValue(1);
		redisMocks.get.mockReset().mockResolvedValue(null);
		redisMocks.on.mockReset();
		redisMocks.quit.mockReset().mockResolvedValue("OK");
		redisMocks.set.mockReset().mockResolvedValue("OK");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("namespaces validated IPv4, IPv6, and missing-trusted-IP rate-limit keys", async () => {
		const backend = createBackend();
		const logger = { warn: vi.fn() };
		const storage = createFailOpenRateLimitSecondaryStorage(backend, logger);

		await expect(storage.get(RATE_LIMIT_KEY)).resolves.toBe("stored");
		await storage.set(RATE_LIMIT_KEY, "value", 30);
		await storage.delete(RATE_LIMIT_KEY);
		await expect(storage.increment?.(RATE_LIMIT_KEY, 30)).resolves.toBe(2);

		expect(backend.get).toHaveBeenCalledWith(NAMESPACED_RATE_LIMIT_KEY);
		expect(backend.set).toHaveBeenCalledWith(
			NAMESPACED_RATE_LIMIT_KEY,
			"value",
			30,
		);
		expect(backend.delete).toHaveBeenCalledWith(NAMESPACED_RATE_LIMIT_KEY);
		expect(backend.increment).toHaveBeenCalledWith(
			NAMESPACED_RATE_LIMIT_KEY,
			30,
		);

		await storage.get("2001:db8::1|/sign-up/email");
		await storage.get("no-trusted-ip|/request-password-reset");

		expect(backend.get).toHaveBeenCalledWith(
			"better-auth:rate-limit:2001:db8::1|/sign-up/email",
		);
		expect(backend.get).toHaveBeenCalledWith(
			"better-auth:rate-limit:no-trusted-ip|/request-password-reset",
		);
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it.each([
		"session-token",
		"active-sessions-user_1",
		"verification:magic-link-token",
		"not-an-ip|/sign-in/email",
		"203.0.113.10|sign-in/email",
	])("does not send non-rate-limit key %s to Redis", async (key) => {
		const backend = createBackend();
		const logger = { warn: vi.fn() };
		const storage = createFailOpenRateLimitSecondaryStorage(backend, logger);

		await expect(storage.get(key)).resolves.toBeNull();
		await storage.set(key, "value", 30);
		await storage.delete(key);
		await expect(storage.increment?.(key, 30)).resolves.toBe(0);

		expect(backend.get).not.toHaveBeenCalled();
		expect(backend.set).not.toHaveBeenCalled();
		expect(backend.delete).not.toHaveBeenCalled();
		expect(backend.increment).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it("swallows backend rejections and warns for every operation", async () => {
		const failure = new Error("Redis unavailable");
		const backend: RateLimitSecondaryStorageBackend = {
			delete: vi.fn(async () => {
				throw failure;
			}),
			get: vi.fn(async () => {
				throw failure;
			}),
			increment: vi.fn(async () => {
				throw failure;
			}),
			set: vi.fn(async () => {
				throw failure;
			}),
		};
		const logger = { warn: vi.fn() };
		const storage = createFailOpenRateLimitSecondaryStorage(backend, logger);

		await expect(storage.get(RATE_LIMIT_KEY)).resolves.toBeNull();
		await expect(storage.set(RATE_LIMIT_KEY, "value", 30)).resolves.toBe(
			undefined,
		);
		await expect(storage.delete(RATE_LIMIT_KEY)).resolves.toBeUndefined();
		await expect(storage.increment?.(RATE_LIMIT_KEY, 30)).resolves.toBe(0);

		expect(logger.warn).toHaveBeenCalledTimes(4);
		for (const operation of ["get", "set", "delete", "increment"]) {
			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining(`Redis ${operation} failed open`),
				failure,
			);
		}
	});

	it("fails open when backend operations exceed the timeout", async () => {
		vi.useFakeTimers();
		const never = () => new Promise<never>(() => undefined);
		const backend: RateLimitSecondaryStorageBackend = {
			delete: vi.fn(never),
			get: vi.fn(never),
			increment: vi.fn(never),
			set: vi.fn(never),
		};
		const logger = { warn: vi.fn() };
		const storage = createFailOpenRateLimitSecondaryStorage(backend, logger, {
			timeoutMs: 25,
		});

		const getResult = storage.get(RATE_LIMIT_KEY);
		const setResult = storage.set(RATE_LIMIT_KEY, "value", 30);
		const deleteResult = storage.delete(RATE_LIMIT_KEY);
		const incrementResult = storage.increment?.(RATE_LIMIT_KEY, 30);

		await vi.advanceTimersByTimeAsync(25);

		await expect(getResult).resolves.toBeNull();
		await expect(setResult).resolves.toBeUndefined();
		await expect(deleteResult).resolves.toBeUndefined();
		await expect(incrementResult).resolves.toBe(0);
		expect(logger.warn).toHaveBeenCalledTimes(4);
		for (const [, error] of logger.warn.mock.calls) {
			expect(error).toMatchObject({
				message: expect.stringContaining("timed out after 25ms"),
				name: "RedisOperationTimeoutError",
			});
		}
	});
});

describe("BetterAuthRedisSecondaryStorage", () => {
	beforeEach(() => {
		redisMocks.constructorOptions.length = 0;
		redisMocks.initialStatus = "ready";
		redisMocks.del.mockReset().mockResolvedValue(1);
		redisMocks.disconnect.mockReset();
		redisMocks.eval.mockReset().mockResolvedValue(1);
		redisMocks.get.mockReset().mockResolvedValue(null);
		redisMocks.on.mockReset();
		redisMocks.quit.mockReset().mockResolvedValue("OK");
		redisMocks.set.mockReset().mockResolvedValue("OK");
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("registers and throttles Redis connection error warnings", () => {
		vi.useFakeTimers();
		const loggerWarn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);

		new BetterAuthRedisSecondaryStorage();

		expect(redisMocks.on).toHaveBeenCalledOnce();
		const [event, listener] = redisMocks.on.mock.calls[0] ?? [];
		expect(event).toBe("error");
		expect(listener).toBeTypeOf("function");

		const firstError = new Error("Redis unavailable");
		listener?.(firstError);
		listener?.(new Error("Redis still unavailable"));

		expect(loggerWarn).toHaveBeenCalledOnce();
		expect(loggerWarn).toHaveBeenCalledWith(
			"Better Auth rate-limit Redis connection error",
			firstError,
		);

		vi.advanceTimersByTime(29_999);
		listener?.(new Error("Redis remains unavailable"));
		expect(loggerWarn).toHaveBeenCalledOnce();

		vi.advanceTimersByTime(1);
		listener?.(new Error("Redis remains unavailable"));
		expect(loggerWarn).toHaveBeenCalledTimes(2);
	});

	it("uses a dedicated client that cannot replay timed-out commands", () => {
		new BetterAuthRedisSecondaryStorage();

		expect(redisMocks.constructorOptions).toEqual([
			expect.objectContaining({
				autoResendUnfulfilledCommands: false,
				commandTimeout: 500,
				enableOfflineQueue: false,
				lazyConnect: true,
				maxRetriesPerRequest: 1,
			}),
		]);
	});

	it("atomically increments and applies the fixed TTL only on creation", async () => {
		redisMocks.eval.mockResolvedValue(4);
		const storage = new BetterAuthRedisSecondaryStorage();

		await expect(storage.increment(RATE_LIMIT_KEY, 60)).resolves.toBe(4);

		const [script, keyCount, key, ttl] = redisMocks.eval.mock.calls[0] ?? [];
		expect(script).toContain('redis.call("INCR", KEYS[1])');
		expect(script).toContain("if count == 1 then");
		expect(script).toContain('redis.call("EXPIRE", KEYS[1], ARGV[1])');
		expect(keyCount).toBe(1);
		expect(key).toBe(NAMESPACED_RATE_LIMIT_KEY);
		expect(ttl).toBe(60);
	});

	it("closes its Redis client during Nest shutdown", async () => {
		const storage = new BetterAuthRedisSecondaryStorage();

		await storage.onModuleDestroy();

		expect(redisMocks.quit).toHaveBeenCalledOnce();
	});

	it("disconnects an unused lazy client without connecting it to quit", async () => {
		redisMocks.initialStatus = "wait";
		const storage = new BetterAuthRedisSecondaryStorage();

		await storage.onModuleDestroy();

		expect(redisMocks.disconnect).toHaveBeenCalledOnce();
		expect(redisMocks.quit).not.toHaveBeenCalled();
	});
});
