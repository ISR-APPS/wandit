/**
 * Redis `TurnLock` (port in `domain/ports/turn-lock.ts`).
 * One key `builder:lock:{projectId}` serializes builder turns per project:
 * the API acquires it before queueing the task and releases it on cancel or
 * stream end; the running task only refreshes it. Compare-and-delete Lua
 * makes a stale holder's release a no-op.
 */
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";
import type { TurnLock } from "../../domain/ports/turn-lock";

/**
 * 30 min. The task refreshes the key every 60 s while it runs, so the TTL
 * only has to outlive one refresh gap — the large margin survives a stalled
 * worker long enough for `stalled` detection to notice first.
 */
export const TURN_LOCK_TTL_MS = 30 * 60_000;

// Timeout for lock commands used by this API process.
const TURN_LOCK_COMMAND_TIMEOUT_MS = 8_000;
// Keep API waits predictable by limiting Redis retries.
const TURN_LOCK_MAX_RETRIES_PER_REQUEST = 2;

// Lua: expire only for the holding turn (a foreign refresh is a no-op).
const TURN_LOCK_REFRESH_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
`;

// Lua: delete only for the holding turn (compare-and-delete).
const TURN_LOCK_RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`;

/** Key and script helpers, exported so the spec pins their exact text. */
export const turnLockRedis = {
	key: (projectId: string) => `builder:lock:${projectId}`,
	refreshScript: TURN_LOCK_REFRESH_SCRIPT,
	releaseScript: TURN_LOCK_RELEASE_SCRIPT,
} as const;

@Injectable()
export class RedisTurnLock implements TurnLock, OnModuleDestroy {
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: TURN_LOCK_COMMAND_TIMEOUT_MS,
			lazyConnect: true,
			maxRetriesPerRequest: TURN_LOCK_MAX_RETRIES_PER_REQUEST,
		}),
	);

	async onModuleDestroy() {
		await this.redis.quit();
	}

	/** `SET builder:lock:{projectId} turnId NX PX ttlMs`. False when held. */
	async acquire(
		projectId: string,
		turnId: string,
		ttlMs: number,
	): Promise<boolean> {
		const result = await this.redis.set(
			turnLockRedis.key(projectId),
			turnId,
			"PX",
			ttlMs,
			"NX",
		);

		return result === "OK";
	}

	/** `PEXPIRE` only when the stored turn id matches. */
	async refresh(
		projectId: string,
		turnId: string,
		ttlMs: number,
	): Promise<boolean> {
		const result: unknown = await this.redis.eval(
			TURN_LOCK_REFRESH_SCRIPT,
			1,
			turnLockRedis.key(projectId),
			turnId,
			ttlMs,
		);

		return result === 1;
	}

	/** Compare-and-delete: removes the key only for the holding turn. */
	async release(projectId: string, turnId: string): Promise<boolean> {
		const result: unknown = await this.redis.eval(
			TURN_LOCK_RELEASE_SCRIPT,
			1,
			turnLockRedis.key(projectId),
			turnId,
		);

		return result === 1;
	}

	/** The holding turn id, or null when the lock is free or expired. */
	holder(projectId: string): Promise<string | null> {
		return this.redis.get(turnLockRedis.key(projectId));
	}
}
