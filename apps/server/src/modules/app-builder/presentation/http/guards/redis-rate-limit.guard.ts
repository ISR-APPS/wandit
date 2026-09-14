/**
 * Redis-backed rate limiting for the V2 turn routes.
 * `turns.controller.ts` marks handlers with `@RateLimit`; the guard reads
 * the metadata, counts in Redis (`INCR` + `PEXPIRE`, fixed window), and
 * throws a 429 with `Retry-After` over the limit. Mode `open` counts
 * concurrent SSE streams instead: the slot frees on `release`.
 */
import {
	type CanActivate,
	type ExecutionContext,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	type OnModuleDestroy,
	SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { env } from "@wandit/env/server";
import type { FastifyReply } from "fastify";
import Redis from "ioredis";
import { createRedisConnectionOptions } from "../../../../../infrastructure/redis/redis-connection";
import type { MaybeAuthenticatedRequest } from "../../../../auth";

/**
 * Metadata key `Reflector` reads to find a route's `RateLimit` options.
 * Exported so controller specs can assert the stored options.
 */
export const RATE_LIMIT_OPTIONS = "app-builder.rate-limit";

export type RateLimitMode = "count" | "open";

export type RateLimitOptions = {
	/** Bucket name; becomes `builder:rate:{key}:{userId}` in Redis. */
	key: string;
	/** Maximum hits per window (`count`) or held slots (`open`). */
	limit: number;
	/** Window length for `count`; slot TTL for `open`. Milliseconds. */
	windowMs: number;
	/** Defaults to `count`. `open` slots free through `store.release`. */
	mode?: RateLimitMode;
};

/** Route decorator; the guard below reads what it stores. */
export function RateLimit(options: RateLimitOptions) {
	return SetMetadata(RATE_LIMIT_OPTIONS, options);
}

export type RateLimitHit = {
	/** Hits or held slots after this request's `INCR`. */
	count: number;
	/** `PTTL` of the bucket key; `-1` when the key has no expiry. */
	ttlMs: number;
};

export interface RateLimitStore {
	/**
	 * `INCR` + fixed-window `PEXPIRE`. `slidingTtl` re-arms the expiry on
	 * every hit — open slots must not expire while a stream holds them.
	 */
	hit(
		key: string,
		windowMs: number,
		slidingTtl: boolean,
	): Promise<RateLimitHit>;
	/** `DECR` floored at 0; frees one `open` slot. */
	release(key: string): Promise<void>;
}

/** Nest token so the guard and the stream relay can take a fake store. */
export const RATE_LIMIT_STORE = Symbol.for("app-builder.rate-limit-store");

/** `turn-stream` bucket name, shared by the route decorator and the relay. */
export const TURN_STREAM_BUCKET = "turn-stream";

/** Full Redis key for one user in one bucket. */
export function rateLimitKey(bucket: string, userId: string): string {
	return `builder:rate:${bucket}:${userId}`;
}

/**
 * Lua: `INCR`, then `PEXPIRE` on the first hit (fixed window) or on every
 * hit when ARGV[2] is `open` (a held slot keeps its lease). Returns
 * `{count, pttl}` so the guard can size `Retry-After` honestly.
 */
const RATE_LIMIT_HIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 or ARGV[2] == "open" then
	redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return {count, redis.call("PTTL", KEYS[1])}
`;

/**
 * Lua: `DECR` floored at 0 — a double release must not go negative, or the
 * next `INCR` starts under zero and admits extra streams.
 */
const RATE_LIMIT_RELEASE_SCRIPT = `
local count = redis.call("DECR", KEYS[1])
if count < 0 then
	redis.call("DEL", KEYS[1])
	return 0
end
return count
`;

/** Key and script text, exported so the spec pins the exact Lua. */
export const rateLimitRedis = {
	hitScript: RATE_LIMIT_HIT_SCRIPT,
	releaseScript: RATE_LIMIT_RELEASE_SCRIPT,
} as const;

// Keep API waits predictable by bounding Redis retries.
const RATE_LIMIT_MAX_RETRIES_PER_REQUEST = 2;

@Injectable()
export class RedisRateLimitStore implements RateLimitStore, OnModuleDestroy {
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			lazyConnect: true,
			maxRetriesPerRequest: RATE_LIMIT_MAX_RETRIES_PER_REQUEST,
		}),
	);

	async hit(
		key: string,
		windowMs: number,
		slidingTtl: boolean,
	): Promise<RateLimitHit> {
		// SAFETY: the Lua above returns `{INCR result, PTTL result}`.
		const [count, ttlMs] = (await this.redis.eval(
			RATE_LIMIT_HIT_SCRIPT,
			1,
			key,
			String(windowMs),
			slidingTtl ? "open" : "count",
		)) as [number, number];
		return { count, ttlMs };
	}

	async release(key: string): Promise<void> {
		await this.redis.eval(RATE_LIMIT_RELEASE_SCRIPT, 1, key);
	}

	async onModuleDestroy(): Promise<void> {
		await this.redis.quit();
	}
}

// `Retry-After` for denied open slots is capped low: a slot frees the
// moment a stream closes, so the honest wait is seconds, not the TTL.
const OPEN_SLOT_RETRY_AFTER_CAP_MS = 60_000;

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
	constructor(
		// A type-only import erases the runtime token; Nest needs the class.
		@Inject(Reflector)
		private readonly reflector: Reflector,
		@Inject(RATE_LIMIT_STORE)
		private readonly store: RateLimitStore,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const options = this.reflector.getAllAndOverride<
			RateLimitOptions | undefined
		>(RATE_LIMIT_OPTIONS, [context.getHandler(), context.getClass()]);
		if (!options) {
			return true;
		}

		const http = context.switchToHttp();
		const request = http.getRequest<MaybeAuthenticatedRequest>();
		const response = http.getResponse<FastifyReply>();
		// The global AuthGuard attaches a user first; an anonymous caller
		// still gets counted under a shared bucket rather than slipping by.
		const key = rateLimitKey(options.key, request.user?.id ?? "anonymous");

		const hit = await this.store.hit(
			key,
			options.windowMs,
			options.mode === "open",
		);
		if (hit.count <= options.limit) {
			return true;
		}

		if (options.mode === "open") {
			// The denied request still ran `INCR`; give the slot back so failed
			// opens cannot pile up against the cap.
			await this.store.release(key);
		}

		const ttlMs = hit.ttlMs > 0 ? hit.ttlMs : options.windowMs;
		const waitMs =
			options.mode === "open"
				? Math.min(ttlMs, OPEN_SLOT_RETRY_AFTER_CAP_MS)
				: ttlMs;
		const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
		// Set on the reply before throwing: ApiExceptionFilter sends on the
		// same object, so the header survives.
		response.header("Retry-After", String(retryAfterSeconds));
		throw new HttpException(
			{ code: "RATE_LIMITED", message: "Rate limit exceeded" },
			HttpStatus.TOO_MANY_REQUESTS,
		);
	}
}
