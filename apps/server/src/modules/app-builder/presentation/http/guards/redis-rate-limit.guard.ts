/**
 * Redis rate limits for the V2 builder routes that carry `@RateLimit`.
 * The guard counts hits per user, and per client IP with `ipLimit`, in a
 * fixed window. Over a limit, it throws a 429 with `Retry-After`. Mode
 * `open` counts SSE slots instead: a slot frees on `release`, or when its
 * window ends. A Redis error lets the request through and sends a Sentry
 * warning. The MCP tools count their buckets with `findRateLimitDenial`.
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
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/nestjs";
import type { FastifyReply } from "fastify";
import Redis from "ioredis";
import { readTrustedClientIp } from "../../../../../infrastructure/http/client-ip";
import { createRedisConnectionOptions } from "../../../../../infrastructure/redis/redis-connection";
import type { MaybeAuthenticatedRequest } from "../../../../auth";

/**
 * Metadata key `Reflector` reads to find a route's `RateLimit` options.
 * Exported so controller specs can assert the stored options.
 */
export const RATE_LIMIT_OPTIONS = "app-builder.rate-limit";

export type RateLimitMode = "count" | "open";

export type RateLimitOptions = {
	/**
	 * Bucket name. The Redis keys are `builder:rate:{key}:{userId}` and, with
	 * `ipLimit`, `builder:rate:{key}:ip:{ip}`.
	 */
	key: string;
	/** Maximum hits per window (`count`) or held slots (`open`) for one user. */
	limit: number;
	/**
	 * Maximum hits per window from one client IP. Only hits under the user
	 * cap count. `count` mode only: the relay frees only the user key.
	 */
	ipLimit?: number;
	/**
	 * Window length in milliseconds. For `open`, also the longest time a slot
	 * stays taken when no `release` frees it.
	 */
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
	 * `INCR` + fixed-window `PEXPIRE`, for both modes. A hit never extends
	 * the window, so a slot that no `release` frees still expires.
	 */
	hit(key: string, windowMs: number): Promise<RateLimitHit>;
	/** `DECR` floored at 0; frees one `open` slot. */
	release(key: string): Promise<void>;
}

/** Nest token so the guard and the stream relay can take a fake store. */
export const RATE_LIMIT_STORE = Symbol.for("app-builder.rate-limit-store");

/** `turn-stream` bucket name, shared by the route decorator and the relay. */
export const TURN_STREAM_BUCKET = "turn-stream";

/**
 * The open slots of the web turn streams and of the MCP `get_turn` waits: 5 per user.
 * A slot stays taken until the stream or the wait ends, or until its window ends.
 * The window is 16 min: Railway ends every HTTP response at 15 min, and the browser then reopens the stream.
 * So no live stream holds a slot for more than 15 min.
 */
// LIMIT: a slot that a killed API never released frees at most 16 min after its window opened.
// A stream that outlives its window releases into the next window, so the cap is soft there.
// Upgrade: one key per stream.
export const TURN_STREAM_RATE_LIMIT = {
	key: TURN_STREAM_BUCKET,
	limit: 5,
	mode: "open",
	windowMs: 16 * 60_000,
} satisfies RateLimitOptions;

/**
 * `POST .../turns` and the MCP `send_prompt` tool: 30 per user and 90 per IP in 10 min.
 * A human cannot click faster. The IP cap is three times the user cap (WANDIT-181).
 * Three people behind one office IP still fit. The cap stops one person who uses many accounts.
 */
export const TURN_CREATE_RATE_LIMIT = {
	ipLimit: 90,
	key: "turn-create",
	limit: 30,
	windowMs: 600_000,
} satisfies RateLimitOptions;

/** `POST .../turns/:turnId/cancel` and the MCP `cancel_turn` tool: 30 per user in 10 min. */
export const TURN_CANCEL_RATE_LIMIT = {
	key: "turn-cancel",
	limit: 30,
	windowMs: 600_000,
} satisfies RateLimitOptions;

/** `POST .../sandbox/wake` and the MCP `wake_sandbox` tool: 6 per user in 10 min. */
export const SANDBOX_WAKE_RATE_LIMIT = {
	key: "sandbox-wake",
	limit: 6,
	windowMs: 10 * 60_000,
} satisfies RateLimitOptions;

/**
 * `POST .../publish`, the gate override, and the MCP `publish_app` tool: 10 per user and
 * 30 per IP in 1 h (WANDIT-181). Each publish wakes a sandbox and runs a build, so the cap
 * stops a script that publishes in a loop. The IP cap is three times the user cap, as above.
 */
export const APP_PUBLISH_RATE_LIMIT = {
	ipLimit: 30,
	key: "app-publish",
	limit: 10,
	windowMs: 60 * 60_000,
} satisfies RateLimitOptions;

/**
 * Full Redis key for one subject in one bucket. The subject is a user id,
 * or `ip:<client ip>` for the IP cap.
 */
export function rateLimitKey(bucket: string, subject: string): string {
	return `builder:rate:${bucket}:${subject}`;
}

/**
 * Lua: `INCR`, then `PEXPIRE` only when the count becomes 1 (fixed window).
 * An `open` hit must not extend the window. A slot that a killed relay did
 * not release must expire, also while the user reopens. Returns
 * `{count, pttl}` so the guard can size `Retry-After` honestly.
 */
const RATE_LIMIT_HIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
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

// Keep API waits predictable by bounding Redis retries.
const RATE_LIMIT_MAX_RETRIES_PER_REQUEST = 2;

// A hung or unreachable Redis throws after this wait, so the guard fails
// open fast. Same value as the Better Auth rate-limit store.
const RATE_LIMIT_COMMAND_TIMEOUT_MS = 500;

/**
 * The Redis side of `RateLimitStore`. One lazy ioredis connection for each
 * API process. A command fails after 500 ms.
 */
@Injectable()
export class RedisRateLimitStore implements RateLimitStore, OnModuleDestroy {
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: RATE_LIMIT_COMMAND_TIMEOUT_MS,
			lazyConnect: true,
			maxRetriesPerRequest: RATE_LIMIT_MAX_RETRIES_PER_REQUEST,
		}),
	);

	async hit(key: string, windowMs: number): Promise<RateLimitHit> {
		// SAFETY: the Lua above returns `{INCR result, PTTL result}`.
		const [count, ttlMs] = (await this.redis.eval(
			RATE_LIMIT_HIT_SCRIPT,
			1,
			key,
			String(windowMs),
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

/**
 * Counts one hit of `userId` in the bucket. When the user is under its cap, it also counts
 * one hit of the client IP. Returns the hit over a limit, or null. A Redis error returns null
 * and sends a Sentry warning. So the route guard and the MCP tools fail open the same way.
 * @param clientIp The trusted client IP from `readTrustedClientIp`, or null: then no IP key counts.
 */
export async function findRateLimitDenial(
	store: RateLimitStore,
	options: RateLimitOptions,
	userId: string,
	clientIp: string | null,
): Promise<RateLimitHit | null> {
	try {
		const userHit = await store.hit(
			rateLimitKey(options.key, userId),
			options.windowMs,
		);
		if (userHit.count > options.limit) {
			return userHit;
		}
		if (
			options.ipLimit === undefined ||
			options.mode === "open" ||
			clientIp === null
		) {
			return null;
		}
		// Only requests under the user cap count on the IP key. So the
		// denied retries of one user do not use the budget of a shared IP.
		// The IP key only adds a cap and never grants access.
		const ipHit = await store.hit(
			rateLimitKey(options.key, `ip:${clientIp}`),
			options.windowMs,
		);
		return ipHit.count > options.ipLimit ? ipHit : null;
	} catch (error) {
		// Fail open: a Redis outage must not take the builder down.
		// LIMIT: an `open` slot that passes here still gets a release when
		// its stream closes, so the user can hold one extra stream for each
		// Redis error until the count floors at 0. Upgrade: fail closed for
		// `open` mode.
		// LIMIT: one Sentry event per request while Redis is down. Upgrade:
		// one warning per minute per process.
		Sentry.captureMessage("Rate limit store failed; request allowed", {
			extra: { error: getErrorMessage(error) },
			level: "warning",
			tags: { bucket: options.key },
		});
		return null;
	}
}

// `Retry-After` for denied open slots is capped low: a slot frees the
// moment a stream closes, so the honest wait is seconds, not the TTL.
const OPEN_SLOT_RETRY_AFTER_CAP_MS = 60_000;

/** Seconds until a denied bucket frees, for `Retry-After`. At least 1. */
export function retryAfterSecondsOf(
	deniedHit: RateLimitHit,
	options: RateLimitOptions,
): number {
	const ttlMs = deniedHit.ttlMs > 0 ? deniedHit.ttlMs : options.windowMs;
	const waitMs =
		options.mode === "open"
			? Math.min(ttlMs, OPEN_SLOT_RETRY_AFTER_CAP_MS)
			: ttlMs;
	return Math.max(1, Math.ceil(waitMs / 1000));
}

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
		const userId = request.user?.id ?? "anonymous";

		// A caller with no trusted IP (no `TRUSTED_PROXY_CIDRS` match) gets no
		// IP key: a shared proxy address must not become one bucket for all.
		const deniedHit = await findRateLimitDenial(
			this.store,
			options,
			userId,
			readTrustedClientIp(request),
		);
		if (!deniedHit) {
			return true;
		}

		if (options.mode === "open") {
			// The denied request still ran `INCR`; give the slot back so failed
			// opens cannot pile up against the cap. A failed release keeps the
			// 429 and does not become a 500: the slot TTL frees the slot.
			try {
				await this.store.release(rateLimitKey(options.key, userId));
			} catch (error) {
				Sentry.captureMessage("Rate limit slot release failed", {
					extra: { error: getErrorMessage(error) },
					level: "warning",
					tags: { bucket: options.key },
				});
			}
		}

		// Set on the reply before throwing: ApiExceptionFilter sends on the
		// same object, so the header survives.
		response.header(
			"Retry-After",
			String(retryAfterSecondsOf(deniedHit, options)),
		);
		throw new HttpException(
			{ code: "RATE_LIMITED", message: "Rate limit exceeded" },
			HttpStatus.TOO_MANY_REQUESTS,
		);
	}
}
