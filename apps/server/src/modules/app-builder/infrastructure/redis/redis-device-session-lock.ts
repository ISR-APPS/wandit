/**
 * Redis `DeviceSessionLock` (port in `domain/ports/device-session-lock.ts`).
 * One key `mobile_preview:user:{userId}` per user holds the open device
 * session id. `DeviceSessionsService` calls it; it reuses the
 * compare-and-delete Lua of the turn lock.
 */
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";
import type { DeviceSessionLock } from "../../domain/ports/device-session-lock";
import { turnLockRedis } from "./redis-turn-lock";

// The start route waits on it, so a slow Redis fails fast, like the turn lock.
const DEVICE_SESSION_LOCK_COMMAND_TIMEOUT_MS = 8_000;
const DEVICE_SESSION_LOCK_MAX_RETRIES_PER_REQUEST = 2;

/** Redis key of the lock of one user. Exported so the spec pins its text. */
export function deviceSessionLockKey(userId: string): string {
	return `mobile_preview:user:${userId}`;
}

@Injectable()
export class RedisDeviceSessionLock
	implements DeviceSessionLock, OnModuleDestroy
{
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: DEVICE_SESSION_LOCK_COMMAND_TIMEOUT_MS,
			lazyConnect: true,
			maxRetriesPerRequest: DEVICE_SESSION_LOCK_MAX_RETRIES_PER_REQUEST,
		}),
	);

	async onModuleDestroy() {
		await this.redis.quit();
	}

	async acquire(
		userId: string,
		deviceSessionId: string,
		ttlMs: number,
	): Promise<boolean> {
		const result = await this.redis.set(
			deviceSessionLockKey(userId),
			deviceSessionId,
			"PX",
			ttlMs,
			"NX",
		);
		return result === "OK";
	}

	async release(userId: string, deviceSessionId: string): Promise<boolean> {
		const result: unknown = await this.redis.eval(
			turnLockRedis.releaseScript,
			1,
			deviceSessionLockKey(userId),
			deviceSessionId,
		);
		return result === 1;
	}
}
