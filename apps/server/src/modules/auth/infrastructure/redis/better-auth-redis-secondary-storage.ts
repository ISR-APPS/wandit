import { isIP } from "node:net";
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { env } from "@wandit/env/server";
import type { SecondaryStorage } from "better-auth/db";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";

const REDIS_COMMAND_TIMEOUT_MS = 500;
const REDIS_ERROR_LOG_THROTTLE_MS = 30_000;
const REDIS_MAX_RETRIES_PER_REQUEST = 1;
const REDIS_KEY_PREFIX = "better-auth:rate-limit:";

// INCR creates a missing key at one. Only that first increment sets the TTL,
// so later requests cannot slide the rate-limit window forward.
const INCREMENT_WITH_FIXED_TTL_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
	redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;

type WarningLogger = Pick<Logger, "warn">;

export interface RateLimitSecondaryStorageBackend {
	delete(key: string): Promise<unknown>;
	get(key: string): Promise<unknown>;
	increment(key: string, ttl: number): Promise<number>;
	set(key: string, value: string, ttl?: number): Promise<unknown>;
}

interface FailOpenStorageOptions {
	keyPrefix?: string;
	timeoutMs?: number;
}

class RedisOperationTimeoutError extends Error {
	constructor(operation: string, timeoutMs: number) {
		super(`Redis ${operation} timed out after ${timeoutMs}ms`);
		this.name = "RedisOperationTimeoutError";
	}
}

/**
 * Accept only Better Auth rate-limit keys. The auth factory wires this port
 * through rateLimit.customStorage instead of root secondaryStorage, because
 * Better Auth 1.6.22 would otherwise divert some session operations from the
 * database.
 */
export function isBetterAuthRateLimitKey(key: string): boolean {
	const separatorIndex = key.indexOf("|");

	if (separatorIndex <= 0) {
		return false;
	}

	const clientIp = key.slice(0, separatorIndex);
	const path = key.slice(separatorIndex + 1);
	const hasValidClientIp = clientIp === "no-trusted-ip" || isIP(clientIp) !== 0;

	return hasValidClientIp && path.startsWith("/");
}

async function withTimeout<T>(
	operation: string,
	timeoutMs: number,
	command: () => Promise<T>,
): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;

	try {
		return await Promise.race([
			Promise.resolve().then(command),
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => {
					reject(new RedisOperationTimeoutError(operation, timeoutMs));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timeout) {
			clearTimeout(timeout);
		}
	}
}

/**
 * Pure Better Auth storage wrapper: it filters and namespaces keys, bounds
 * every operation, and converts Redis failures into safe rate-limit misses.
 */
export function createFailOpenRateLimitSecondaryStorage(
	backend: RateLimitSecondaryStorageBackend,
	logger: WarningLogger,
	options: FailOpenStorageOptions = {},
): SecondaryStorage {
	const keyPrefix = options.keyPrefix ?? REDIS_KEY_PREFIX;
	const timeoutMs = options.timeoutMs ?? REDIS_COMMAND_TIMEOUT_MS;

	async function failOpen<T>(
		operation: string,
		fallback: T,
		command: () => Promise<T>,
	): Promise<T> {
		try {
			return await withTimeout(operation, timeoutMs, command);
		} catch (error) {
			// Deliberately fail open: Redis must never turn an auth endpoint outage
			// into an application-wide authentication outage.
			logger.warn(
				`Better Auth rate-limit Redis ${operation} failed open`,
				error,
			);
			return fallback;
		}
	}

	function namespacedKey(key: string): string {
		return `${keyPrefix}${key}`;
	}

	return {
		async delete(key) {
			if (!isBetterAuthRateLimitKey(key)) {
				return;
			}

			await failOpen("delete", undefined, async () => {
				await backend.delete(namespacedKey(key));
			});
		},
		async get(key) {
			if (!isBetterAuthRateLimitKey(key)) {
				return null;
			}

			return failOpen("get", null, () => backend.get(namespacedKey(key)));
		},
		async increment(key, ttl) {
			if (!isBetterAuthRateLimitKey(key)) {
				return 0;
			}

			return failOpen("increment", 0, () =>
				backend.increment(namespacedKey(key), ttl),
			);
		},
		async set(key, value, ttl) {
			if (!isBetterAuthRateLimitKey(key)) {
				return;
			}

			await failOpen("set", undefined, async () => {
				await backend.set(namespacedKey(key), value, ttl);
			});
		},
	};
}

function normalizeTtlSeconds(ttl: number): number {
	return Math.max(1, Math.ceil(ttl));
}

function createRedisBackend(redis: Redis): RateLimitSecondaryStorageBackend {
	return {
		async delete(key) {
			await redis.del(key);
		},
		get: (key) => redis.get(key),
		async increment(key, ttl) {
			const result = await redis.eval(
				INCREMENT_WITH_FIXED_TTL_SCRIPT,
				1,
				key,
				normalizeTtlSeconds(ttl),
			);

			return Number(result);
		},
		async set(key, value, ttl) {
			if (ttl === undefined) {
				await redis.set(key, value);
				return;
			}

			await redis.set(key, value, "EX", normalizeTtlSeconds(ttl));
		},
	};
}

@Injectable()
export class BetterAuthRedisSecondaryStorage
	implements SecondaryStorage, OnModuleDestroy
{
	private readonly logger = new Logger(BetterAuthRedisSecondaryStorage.name);
	private readonly redis = new Redis({
		...createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
			lazyConnect: true,
			maxRetriesPerRequest: REDIS_MAX_RETRIES_PER_REQUEST,
		}),
		// A timed-out rate-limit command must not run later after Redis
		// reconnects, because that could create false 429 responses.
		autoResendUnfulfilledCommands: false,
		enableOfflineQueue: false,
	});
	private readonly storage = createFailOpenRateLimitSecondaryStorage(
		createRedisBackend(this.redis),
		this.logger,
	);

	constructor() {
		let lastErrorLoggedAt = Number.NEGATIVE_INFINITY;

		this.redis.on("error", (error) => {
			const now = Date.now();
			if (now - lastErrorLoggedAt < REDIS_ERROR_LOG_THROTTLE_MS) {
				return;
			}

			lastErrorLoggedAt = now;
			this.logger.warn("Better Auth rate-limit Redis connection error", error);
		});
	}

	async delete(key: string): Promise<void> {
		await this.storage.delete(key);
	}

	async get(key: string): Promise<unknown> {
		return this.storage.get(key);
	}

	async increment(key: string, ttl: number): Promise<number> {
		return (await this.storage.increment?.(key, ttl)) ?? 0;
	}

	async onModuleDestroy(): Promise<void> {
		if (this.redis.status === "end") {
			return;
		}
		if (this.redis.status === "wait") {
			// A lazy client that never handled a command must not connect just to quit.
			this.redis.disconnect();
			return;
		}

		try {
			await this.redis.quit();
		} catch {
			this.redis.disconnect();
		}
	}

	async set(key: string, value: string, ttl?: number): Promise<void> {
		await this.storage.set(key, value, ttl);
	}
}
