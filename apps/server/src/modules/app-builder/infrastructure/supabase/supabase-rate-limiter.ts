/**
 * Fixed-window rate limiter for the Supabase Management API.
 * `SupabaseManagementClient` calls `take` before every request, so the
 * calls stay under the documented 120-per-minute buckets. The fake for
 * specs lives in `fake-supabase-rate-limiter.ts`.
 */
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";

// Fixed one-minute window per bucket, same shape as the LLM spend counters.
const RATE_WINDOW_MS = 60_000;

/**
 * Counts one call in `bucket`'s current minute window. Answers 0 when the
 * call may go now, else the milliseconds until the window ends.
 */
export interface SupabaseRateLimiter {
	take(bucket: string, limitPerMinute: number): Promise<number>;
}

/** Redis keys of the buckets; exported so specs can pin their shape. */
export const supabaseRateLimitKeys = {
	org: () => "supabase:rl:org",
	project: (ref: string) => `supabase:rl:project:${ref}`,
};

// Lua: `INCR`, then `PEXPIRE` on the first hit so the window stays a fixed
// minute — the pattern of `llm-spend-counters.ts`. Over the limit the
// script answers the key TTL; at or under the limit it answers 0.
const SUPABASE_RATE_TAKE_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
	redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
if count > tonumber(ARGV[2]) then
	return redis.call("PTTL", KEYS[1])
end
return 0
`;

/**
 * One `ioredis` client on `REDIS_URL` per instance;
 * `createProvisionBackendRuntime` builds one per run and `close` quits it.
 */
@Injectable()
export class RedisSupabaseRateLimiter
	implements SupabaseRateLimiter, OnModuleDestroy
{
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

	async take(bucket: string, limitPerMinute: number): Promise<number> {
		// SAFETY: the Lua script answers a Redis integer: the PTTL wait in
		// milliseconds, or 0.
		return (await this.redis.eval(
			SUPABASE_RATE_TAKE_SCRIPT,
			1,
			bucket,
			String(RATE_WINDOW_MS),
			String(limitPerMinute),
		)) as number;
	}
}
