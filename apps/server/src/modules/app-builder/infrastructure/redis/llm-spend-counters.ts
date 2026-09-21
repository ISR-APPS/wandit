/**
 * Redis dollar counters and rate limits for the V2 LLM proxy.
 * `LlmProxyService` reads them before each upstream call and adds to them
 * after each priced response. All values are integer USD micros via INCRBY,
 * so concurrent requests cannot lose spend the way a read-modify-write can.
 */
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";

// Fixed one-minute window for the per-run request rate limit.
const RUN_RATE_WINDOW_MS = 60_000;

// 120 requests per minute per run. ESTIMATE: generous for one agent loop;
// WANDIT-181 may tighten it.
export const LLM_RUN_RATE_LIMIT_PER_MINUTE = 120;

// Daily per-user spend ceiling in whole USD. ESTIMATE until WANDIT-174
// replaces it with plan-aware limits.
export const LLM_PROXY_DAILY_USER_CAP_USD = 50;

// 48 h: outlives the day key so a day-boundary request still lands on it.
const USER_SPEND_TTL_SECONDS = 48 * 60 * 60;

// Lua: `INCR`, then `PEXPIRE` on the first hit so the window stays a
// fixed minute. One round trip keeps counter and expiry atomic. A crash
// between commands can no longer leave a key without a TTL.
const RUN_RATE_HIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
	redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return count
`;

/** Redis keys the proxy uses; exported so specs can pin their shape. */
export const llmSpendRedisKeys = {
	run: (runId: string) => `llm:spend:run:${runId}`,
	// `dayKey` is a UTC `yyyymmdd` string; one counter per user per day.
	user: (userId: string, dayKey: string) =>
		`llm:spend:user:${userId}:${dayKey}`,
	runRate: (runId: string) => `llm:rl:run:${runId}`,
	// Set while the run token could still be alive; the proxy 401s on it.
	revokedRun: (runId: string) => `llm:revoked:run:${runId}`,
};

/**
 * The counter operations the proxy needs. `LlmSpendCounters` is the Redis
 * implementation; `FakeLlmSpendCounters` fakes it in specs.
 */
export interface LlmSpendCounterStore {
	// Adds micros to the run counter and refreshes its TTL. Returns the sum.
	addRunSpend(
		runId: string,
		usdMicros: number,
		ttlSeconds: number,
	): Promise<number>;
	// Adds micros to the user's day counter. Returns the sum.
	addUserSpend(
		userId: string,
		dayKey: string,
		usdMicros: number,
	): Promise<number>;
	// Run spend so far in micros; 0 when no row exists.
	readRunSpend(runId: string): Promise<number>;
	// User spend today in micros; 0 when no row exists.
	readUserSpend(userId: string, dayKey: string): Promise<number>;
	// Counts one request inside the run's current minute window. Returns the
	// window count; the caller compares it to LLM_RUN_RATE_LIMIT_PER_MINUTE.
	hitRunRateLimit(runId: string): Promise<number>;
	// Kills the run's proxy token before its natural expiry: the turn ended.
	// `ttlSeconds` must cover the token's remaining life.
	revokeRun(runId: string, ttlSeconds: number): Promise<void>;
	// True when `revokeRun` ran for this run id and the key has not expired.
	isRunRevoked(runId: string): Promise<boolean>;
}

/** Redis implementation of the spend counters. */
@Injectable()
export class LlmSpendCounters implements LlmSpendCounterStore, OnModuleDestroy {
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: 8_000,
			lazyConnect: true,
			maxRetriesPerRequest: 2,
		}),
	);

	async onModuleDestroy() {
		await this.redis.quit();
	}

	async addRunSpend(
		runId: string,
		usdMicros: number,
		ttlSeconds: number,
	): Promise<number> {
		const key = llmSpendRedisKeys.run(runId);
		const total = await this.redis.incrby(key, usdMicros);
		await this.redis.expire(key, ttlSeconds);
		return total;
	}

	async addUserSpend(
		userId: string,
		dayKey: string,
		usdMicros: number,
	): Promise<number> {
		const key = llmSpendRedisKeys.user(userId, dayKey);
		const total = await this.redis.incrby(key, usdMicros);
		await this.redis.expire(key, USER_SPEND_TTL_SECONDS);
		return total;
	}

	async readRunSpend(runId: string): Promise<number> {
		return this.readMicros(llmSpendRedisKeys.run(runId));
	}

	async readUserSpend(userId: string, dayKey: string): Promise<number> {
		return this.readMicros(llmSpendRedisKeys.user(userId, dayKey));
	}

	async hitRunRateLimit(runId: string): Promise<number> {
		const key = llmSpendRedisKeys.runRate(runId);
		// SAFETY: the Lua script returns the INCR result, an integer.
		return (await this.redis.eval(
			RUN_RATE_HIT_SCRIPT,
			1,
			key,
			String(RUN_RATE_WINDOW_MS),
		)) as number;
	}

	async revokeRun(runId: string, ttlSeconds: number): Promise<void> {
		// The value carries nothing; the key's existence is the revocation.
		await this.redis.set(
			llmSpendRedisKeys.revokedRun(runId),
			"1",
			"EX",
			ttlSeconds,
		);
	}

	async isRunRevoked(runId: string): Promise<boolean> {
		return (await this.redis.exists(llmSpendRedisKeys.revokedRun(runId))) === 1;
	}

	private async readMicros(key: string): Promise<number> {
		const value = await this.redis.get(key);
		return value === null ? 0 : Number(value);
	}
}
