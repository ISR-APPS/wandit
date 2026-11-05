/**
 * Redis store for Better Auth rate-limit counters, shared by every API process.
 * AuthModule injects it into `createAuth`, which reads only `increment`.
 * It calls Redis through ioredis and fails open when Redis errors or is slow.
 */
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

// Better Auth reads only `increment`, through rateLimit.customStorage. The
// store never becomes root secondaryStorage, so it has no other method.
type RateLimitCounter = Pick<SecondaryStorage, "increment">;

/** The Redis call of the store. The spec passes an in-memory fake. */
export interface RateLimitSecondaryStorageBackend {
	increment(key: string, ttl: number): Promise<number>;
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
 * through rateLimit.customStorage, never as root secondaryStorage, so session
 * and verification records stay in Postgres.
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
 * Pure Better Auth counter wrapper: it filters and namespaces keys, bounds
 * each increment, and converts Redis failures into safe rate-limit misses.
 */
export function createFailOpenRateLimitSecondaryStorage(
	backend: RateLimitSecondaryStorageBackend,
	logger: WarningLogger,
	options: FailOpenStorageOptions = {},
): RateLimitCounter {
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
		async increment(key, ttl) {
			if (!isBetterAuthRateLimitKey(key)) {
				return 0;
			}

			return failOpen("increment", 0, () =>
				backend.increment(namespacedKey(key), ttl),
			);
		},
	};
}

function normalizeTtlSeconds(ttl: number): number {
	return Math.max(1, Math.ceil(ttl));
}

function createRedisBackend(redis: Redis): RateLimitSecondaryStorageBackend {
	return {
		async increment(key, ttl) {
			const result = await redis.eval(
				INCREMENT_WITH_FIXED_TTL_SCRIPT,
				1,
				key,
				normalizeTtlSeconds(ttl),
			);

			return Number(result);
		},
	};
}

@Injectable()
export class BetterAuthRedisSecondaryStorage
	implements RateLimitCounter, OnModuleDestroy
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

	async increment(key: string, ttl: number): Promise<number> {
		return this.storage.increment(key, ttl);
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
}
