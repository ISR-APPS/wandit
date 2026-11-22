/**
 * Redis cache of the text that replaces an image or PDF block for a text-only builder model.
 * `LlmProxyService` reads it before it describes an image or extracts a PDF, and writes it after.
 * The key is the sha256 of the block bytes. A cache failure only logs, so it never fails a request.
 */
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";

/**
 * 7 days, the TTL of a good text. The same text for the same bytes keeps the prompt cache prefix stable.
 * A chat that comes back within a week also pays no second description.
 */
export const BLOCK_TEXT_CACHE_TTL_SEC = 7 * 86_400;

// The same command limits as the other builder Redis clients: a slow Redis delays a request by seconds, not minutes.
const BLOCK_TEXT_CACHE_COMMAND_TIMEOUT_MS = 8_000;
const BLOCK_TEXT_CACHE_MAX_RETRIES_PER_REQUEST = 2;

/**
 * The Redis key of one block text. `sha256` is the hex sha256 of the decoded block bytes.
 * Bump `v1` when the describer model or prompt changes, so old descriptions go away.
 */
function blockTextCacheKeyOf(sha256: string): string {
	return `builder:llm-proxy:block-text:v1:${sha256}`;
}

/** The two methods `LlmProxyService` calls. A spec passes a fake with a Map. */
export type BlockTextCache = Pick<RedisBlockTextCache, "getMany" | "set">;

/**
 * The block text cache of the LLM proxy. All users share it: only a caller
 * that holds the same bytes can compute the key of their text.
 */
@Injectable()
export class RedisBlockTextCache implements OnModuleDestroy {
	private readonly logger = new Logger(RedisBlockTextCache.name);
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: BLOCK_TEXT_CACHE_COMMAND_TIMEOUT_MS,
			lazyConnect: true,
			maxRetriesPerRequest: BLOCK_TEXT_CACHE_MAX_RETRIES_PER_REQUEST,
		}),
	);

	async onModuleDestroy() {
		await this.redis.quit();
	}

	/** The cached text of each hash that has one. A Redis error gives an empty map. */
	async getMany(sha256s: readonly string[]): Promise<Map<string, string>> {
		const texts = new Map<string, string>();
		if (sha256s.length === 0) {
			return texts;
		}
		try {
			const values = await this.redis.mget(sha256s.map(blockTextCacheKeyOf));
			sha256s.forEach((sha256, index) => {
				const value = values[index];
				if (value !== null && value !== undefined) {
					texts.set(sha256, value);
				}
			});
		} catch (error) {
			// The proxy makes the texts again. That costs one more describer call per image.
			this.logger.warn("block-text-cache.get-failed", {
				count: sha256s.length,
				message: getErrorMessage(error),
			});
		}
		return texts;
	}

	/** Stores `text` for `ttlSec` seconds. A Redis error only logs: a later request pays again. */
	async set(sha256: string, text: string, ttlSec: number): Promise<void> {
		try {
			await this.redis.set(blockTextCacheKeyOf(sha256), text, "EX", ttlSec);
		} catch (error) {
			this.logger.warn("block-text-cache.set-failed", {
				message: getErrorMessage(error),
			});
		}
	}
}
