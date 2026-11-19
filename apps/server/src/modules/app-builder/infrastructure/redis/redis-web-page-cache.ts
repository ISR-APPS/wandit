/**
 * Redis cache of the pages that the `web_fetch` host tool reads.
 * `builder-turn.deps.ts` creates one per task run and closes it. The tool
 * calls `get` before it pays for a page and `set` after a good read.
 * A cache failure only logs, so it never fails a page read.
 */
import { createHash } from "node:crypto";

import { cachedWebPageSchema } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";
import type { WebPage } from "../../domain/ports/web-pages";

/** 24 h. Firecrawl recommends 1 day for content that changes daily. */
export const WEB_PAGE_CACHE_TTL_SEC = 86_400;

// The same command limits as the other builder Redis clients: a slow Redis delays a read by seconds, not minutes.
const WEB_PAGE_CACHE_COMMAND_TIMEOUT_MS = 8_000;
const WEB_PAGE_CACHE_MAX_RETRIES_PER_REQUEST = 2;

/**
 * The Redis key of one page. `url` is a valid URL: the tool input schema
 * parses it first. Two URLs that differ only in host case or in the fragment
 * give one key, because they name one page.
 */
export function webPageCacheKeyOf(url: string): string {
	// The URL parser already lower-cases the host. A fragment names a place in the page, not another page.
	const page = new URL(url);
	page.hash = "";
	// A hash keeps the key short and keeps the address out of Redis key lists.
	return `builder:web-fetch:v1:${createHash("sha256").update(page.href).digest("hex")}`;
}

/**
 * The page cache of `web_fetch`. `logger` gets one line for each cache failure.
 * All users share the cache, because the pages are public.
 * The URL guard of the tool refuses a URL with user info.
 */
export class RedisWebPageCache {
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: WEB_PAGE_CACHE_COMMAND_TIMEOUT_MS,
			lazyConnect: true,
			maxRetriesPerRequest: WEB_PAGE_CACHE_MAX_RETRIES_PER_REQUEST,
		}),
	);

	constructor(private readonly logger: Pick<Console, "warn">) {}

	/** The cached page of `url`, or null on a miss, a Redis error, or a bad value. */
	async get(url: string): Promise<WebPage | null> {
		try {
			const value = await this.redis.get(webPageCacheKeyOf(url));
			return value === null
				? null
				: cachedWebPageSchema.parse(JSON.parse(value));
		} catch (error) {
			// The tool reads the page from the provider instead. The message holds no page address.
			this.logger.warn("web-page-cache.get-failed", {
				message: getErrorMessage(error),
			});
			return null;
		}
	}

	/** Stores `page` for 24 h. A Redis error only logs: a read in a later turn pays again. */
	async set(url: string, page: WebPage): Promise<void> {
		try {
			await this.redis.set(
				webPageCacheKeyOf(url),
				JSON.stringify(page),
				"EX",
				WEB_PAGE_CACHE_TTL_SEC,
			);
		} catch (error) {
			this.logger.warn("web-page-cache.set-failed", {
				message: getErrorMessage(error),
			});
		}
	}

	/** Ends the Redis client. `builder-turn.deps.ts` calls it at the end of the task run. */
	async close(): Promise<void> {
		await this.redis.quit();
	}
}
