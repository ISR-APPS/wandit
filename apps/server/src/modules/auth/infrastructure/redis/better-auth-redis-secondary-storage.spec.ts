import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
	constructorOptions: [] as unknown[],
	disconnect: vi.fn<() => void>(),
	eval: vi.fn<
		(
			script: string,
			keyCount: number,
			key: string,
			ttl: number,
		) => Promise<unknown>
	>(),
	initialStatus: "ready",
	on: vi.fn<(event: string, listener: (error: Error) => void) => void>(),
	quit: vi.fn<() => Promise<"OK">>(),
}));

vi.mock("ioredis", () => ({
	default: class FakeRedis {
		status: string;

		constructor(options: unknown) {
			this.status = redisMocks.initialStatus;
			redisMocks.constructorOptions.push(options);
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

		on(event: string, listener: (error: Error) => void): this {
			redisMocks.on(event, listener);
			return this;
		}

		async quit(): Promise<"OK"> {
			this.status = "end";
			return redisMocks.quit();
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
		increment: vi.fn(async () => 2),
	};
}

describe("createFailOpenRateLimitSecondaryStorage", () => {
	beforeEach(() => {
		redisMocks.constructorOptions.length = 0;
		redisMocks.initialStatus = "ready";
		redisMocks.disconnect.mockReset();
		redisMocks.eval.mockReset().mockResolvedValue(1);
		redisMocks.on.mockReset();
		redisMocks.quit.mockReset().mockResolvedValue("OK");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("namespaces validated IPv4, IPv6, and missing-trusted-IP rate-limit keys", async () => {
		const backend = createBackend();
		const logger = { warn: vi.fn() };
		const storage = createFailOpenRateLimitSecondaryStorage(backend, logger);

		await expect(storage.increment(RATE_LIMIT_KEY, 30)).resolves.toBe(2);
		await storage.increment("2001:db8::1|/sign-up/email", 30);
		await storage.increment("no-trusted-ip|/request-password-reset", 30);

		expect(backend.increment).toHaveBeenCalledWith(
			NAMESPACED_RATE_LIMIT_KEY,
			30,
		);
		expect(backend.increment).toHaveBeenCalledWith(
			"better-auth:rate-limit:2001:db8::1|/sign-up/email",
			30,
		);
		expect(backend.increment).toHaveBeenCalledWith(
			"better-auth:rate-limit:no-trusted-ip|/request-password-reset",
			30,
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

		await expect(storage.increment(key, 30)).resolves.toBe(0);

		expect(backend.increment).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it("swallows a backend rejection and warns", async () => {
		const failure = new Error("Redis unavailable");
		const backend: RateLimitSecondaryStorageBackend = {
			increment: vi.fn(async () => {
				throw failure;
			}),
		};
		const logger = { warn: vi.fn() };
		const storage = createFailOpenRateLimitSecondaryStorage(backend, logger);

		await expect(storage.increment(RATE_LIMIT_KEY, 30)).resolves.toBe(0);

		expect(logger.warn).toHaveBeenCalledOnce();
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Redis increment failed open"),
			failure,
		);
	});

	it("fails open when the backend exceeds the timeout", async () => {
		vi.useFakeTimers();
		const never = () => new Promise<never>(() => undefined);
		const backend: RateLimitSecondaryStorageBackend = {
			increment: vi.fn(never),
		};
		const logger = { warn: vi.fn() };
		const storage = createFailOpenRateLimitSecondaryStorage(backend, logger, {
			timeoutMs: 25,
		});

		const incrementResult = storage.increment(RATE_LIMIT_KEY, 30);

		await vi.advanceTimersByTimeAsync(25);

		await expect(incrementResult).resolves.toBe(0);
		expect(logger.warn).toHaveBeenCalledOnce();
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
		redisMocks.disconnect.mockReset();
		redisMocks.eval.mockReset().mockResolvedValue(1);
		redisMocks.on.mockReset();
		redisMocks.quit.mockReset().mockResolvedValue("OK");
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
