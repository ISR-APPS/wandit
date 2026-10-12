/**
 * Redis dollar counters and rate limits for the V2 LLM proxy.
 * `LlmProxyService` reads them before each upstream call and adds to them
 * after each priced response. All values are integer USD micros via INCRBY,
 * so concurrent requests cannot lose spend the way a read-modify-write can.
 * The `builder-turn` runtime reads the run spend and the in-flight count,
 * and it writes the chat binding that names the turn a chat runs now.
 */
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import {
	type LlmProxyChatBinding,
	llmProxyChatBindingSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Redis from "ioredis";
import { z } from "zod";

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

// LIMIT: an API crash between the admit and the finish leaves the in-flight
// count up for 15 min; a settle then waits its full window. Upgrade: one
// key per request id, so a dead request expires alone.
const IN_FLIGHT_TTL_MS = 15 * 60_000;

// A character no user id holds; it marks where the user id goes in the key.
const USER_ID_MARK = "\u0000";

/**
 * The reply of `ADMIT_REQUEST_SCRIPT`: the chat binding JSON, the revoke
 * flag, the window count, the run spend, the user spend. Redis answers are
 * a trust boundary, so the tuple is parsed before use.
 */
const admitReplySchema = z.tuple([
	z.string().nullable(),
	z.number(),
	z.number(),
	z.string().nullable(),
	z.string().nullable(),
]);

// Lua, one round trip for every check of one proxied request. A bound chat
// moves the request to the run and user of the turn that runs now. Then the
// script reads the revoke flag, counts the rate window (PEXPIRE on the first
// hit keeps the window a fixed minute), reads both spend counters, and marks
// the request in flight. KEYS[1] is the chat binding key. ARGV: token run
// id, token user id, window ms, in-flight TTL ms, then the key parts.
// LIMIT: the script builds keys from ARGV, so it runs on one Redis node, not
// on Redis Cluster. Upgrade: hash-tag every key by run id.
const ADMIT_REQUEST_SCRIPT = `
local runId = ARGV[1]
local userId = ARGV[2]
local binding = redis.call("GET", KEYS[1])
if binding then
	local bound = cjson.decode(binding)
	runId = bound.runId
	userId = bound.userId
end
local revoked = redis.call("EXISTS", ARGV[5] .. runId)
local rateKey = ARGV[6] .. runId
local hits = redis.call("INCR", rateKey)
if hits == 1 then
	redis.call("PEXPIRE", rateKey, ARGV[3])
end
local runSpend = redis.call("GET", ARGV[7] .. runId)
local userSpend = redis.call("GET", ARGV[8] .. userId .. ARGV[9])
local inFlightKey = ARGV[10] .. runId
redis.call("INCR", inFlightKey)
redis.call("PEXPIRE", inFlightKey, ARGV[4])
return { binding or false, revoked, hits, runSpend or false, userSpend or false }
`;

// Lua compare-and-delete: only the turn that wrote the binding removes it,
// so a late cleanup of an old turn cannot unbind the turn that runs now.
const UNBIND_CHAT_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if value and cjson.decode(value).turnId == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
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
	// Requests of the run that passed admission and have no row yet.
	inFlight: (runId: string) => `llm:inflight:run:${runId}`,
	// The turn the chat runs now; see `llmProxyChatBindingSchema`.
	chat: (chatId: string) => `llm:chat:${chatId}`,
};

/** The token claims `admitRequest` starts from. */
export type LlmRequestToken = {
	runId: string;
	userId: string;
	/** The chat claim of the token; null on a token minted before it existed. */
	chatId: string | null;
};

/** What the proxy reads before it forwards one request. */
export type LlmRequestAdmission = {
	/**
	 * The turn the token's chat runs now, or null. When set, the other fields
	 * belong to its run and user, and the request is billed to that turn.
	 */
	binding: LlmProxyChatBinding | null;
	/** True when the turn ended and its run token is dead. */
	revoked: boolean;
	/** Requests of the run in the current one-minute window, this one included. */
	rateHits: number;
	/** Run spend so far, in USD micros. */
	runSpendMicros: number;
	/** User spend today (UTC day of `dayKey`), in USD micros. */
	userSpendMicros: number;
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
	// One round trip before a request: follows the chat binding, reads the
	// revoke flag and both spend counters, counts the request in the run's
	// minute window, and marks it in flight. Every admit needs one
	// `finishRequest` with the admitted run id after the row write.
	admitRequest(
		token: LlmRequestToken,
		dayKey: string,
	): Promise<LlmRequestAdmission>;
	// Ends the in-flight mark of one admitted request.
	finishRequest(runId: string): Promise<void>;
	// Admitted requests of the run without a row yet; 0 when none.
	readInFlight(runId: string): Promise<number>;
	// Points the chat at the turn that runs now, for `ttlSeconds`.
	bindChat(
		chatId: string,
		binding: LlmProxyChatBinding,
		ttlSeconds: number,
	): Promise<void>;
	// Removes the chat binding when it still names `turnId`.
	unbindChat(chatId: string, turnId: string): Promise<void>;
	// Kills the run's proxy token before its natural expiry: the turn ended.
	// `ttlSeconds` must cover the token's remaining life.
	revokeRun(runId: string, ttlSeconds: number): Promise<void>;
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
		return this.readNumber(llmSpendRedisKeys.run(runId));
	}

	async admitRequest(
		token: LlmRequestToken,
		dayKey: string,
	): Promise<LlmRequestAdmission> {
		// The user id sits in the middle of the user key: the script joins the
		// part before it, the user id, and the part after it.
		const [userKeyHead, userKeyTail] = llmSpendRedisKeys
			.user(USER_ID_MARK, dayKey)
			.split(USER_ID_MARK);
		// One script, one round trip: Redis runs in another region than the
		// API, so each serial call costs one more network round trip.
		const reply = await this.redis.eval(
			ADMIT_REQUEST_SCRIPT,
			1,
			// A token without a chat reads a key that is never written.
			llmSpendRedisKeys.chat(token.chatId ?? "none"),
			token.runId,
			token.userId,
			String(RUN_RATE_WINDOW_MS),
			String(IN_FLIGHT_TTL_MS),
			llmSpendRedisKeys.revokedRun(""),
			llmSpendRedisKeys.runRate(""),
			llmSpendRedisKeys.run(""),
			userKeyHead ?? "",
			userKeyTail ?? "",
			llmSpendRedisKeys.inFlight(""),
		);
		const [binding, revoked, rateHits, runSpend, userSpend] =
			admitReplySchema.parse(reply);
		return {
			binding:
				binding === null
					? null
					: llmProxyChatBindingSchema.parse(JSON.parse(binding)),
			rateHits,
			revoked: revoked === 1,
			runSpendMicros: runSpend === null ? 0 : Number(runSpend),
			userSpendMicros: userSpend === null ? 0 : Number(userSpend),
		};
	}

	async finishRequest(runId: string): Promise<void> {
		await this.redis.decr(llmSpendRedisKeys.inFlight(runId));
	}

	async readInFlight(runId: string): Promise<number> {
		return this.readNumber(llmSpendRedisKeys.inFlight(runId));
	}

	async bindChat(
		chatId: string,
		binding: LlmProxyChatBinding,
		ttlSeconds: number,
	): Promise<void> {
		await this.redis.set(
			llmSpendRedisKeys.chat(chatId),
			JSON.stringify(binding),
			"EX",
			ttlSeconds,
		);
	}

	async unbindChat(chatId: string, turnId: string): Promise<void> {
		await this.redis.eval(
			UNBIND_CHAT_SCRIPT,
			1,
			llmSpendRedisKeys.chat(chatId),
			turnId,
		);
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

	// A missing key reads as 0; the stored value is a decimal string.
	private async readNumber(key: string): Promise<number> {
		const value = await this.redis.get(key);
		return value === null ? 0 : Number(value);
	}
}
