/**
 * Redis helper used by the API for chat streaming.
 *
 * It does two jobs:
 * 1. Stores/reads the "this chat is busy" flag.
 * 2. Reads Redis Stream events that the worker published.
 */
// `@Injectable()` lets Nest inject this class. `OnModuleDestroy` lets it close
// Redis connections when the app shuts down.
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { type ChatStreamEvent, chatStreamEventSchema } from "@wandit/contracts";
import { env } from "@wandit/env/server";
// ioredis is the Redis client.
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";

// Keep stream history for reconnects, but not forever.
const STREAM_TTL_SECONDS = 24 * 60 * 60;
// Busy flag TTL while the worker is generating.
const ACTIVE_TTL_SECONDS = 15 * 60;
// Short reservation TTL before the worker has fully started.
const ACTIVE_RESERVATION_TTL_SECONDS = 60;
// Field name used inside each Redis Stream entry.
const EVENT_FIELD = "event";
// Timeout for Redis commands used by this API process.
const XREAD_COMMAND_TIMEOUT_MS = 8_000;
// Keep API waits predictable by limiting Redis retries.
const API_REDIS_MAX_RETRIES_PER_REQUEST = 2;
// Lua script: delete the busy flag only if this job still owns it.
const COMPARE_AND_DELETE_ACTIVE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`;

// One valid Redis event ready to send as SSE.
export type ChatStreamEntry = {
	event: ChatStreamEvent;
	id: string;
};

// Separate Redis client used for blocking XREAD calls.
export type BlockingRedisClient = Redis;

@Injectable()
// API-side Redis adapter for chat events and busy flags.
export class ChatEventsRepository implements OnModuleDestroy {
	// Normal Redis client for quick commands.
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: XREAD_COMMAND_TIMEOUT_MS,
			lazyConnect: true,
			maxRetriesPerRequest: API_REDIS_MAX_RETRIES_PER_REQUEST,
		}),
	);

	// Close Redis when Nest shuts down.
	async onModuleDestroy() {
		await this.redis.quit();
	}

	// Create a separate client because XREAD can block/wait.
	createBlockingClient(): BlockingRedisClient {
		return new Redis(
			createRedisConnectionOptions(env.REDIS_URL, {
				commandTimeout: XREAD_COMMAND_TIMEOUT_MS,
				maxRetriesPerRequest: API_REDIS_MAX_RETRIES_PER_REQUEST,
			}),
		);
	}

	// Close the separate blocking client.
	async closeBlockingClient(client: BlockingRedisClient): Promise<void> {
		if (client.status === "end") {
			return;
		}

		try {
			await client.quit();
		} catch {
			client.disconnect();
		}
	}

	// Return the job id currently marking this chat as busy.
	getActiveJobId(chatId: string): Promise<string | null> {
		return this.redis.get(this.activeKey(chatId));
	}

	// Try to claim the busy flag. NX means "only if it does not exist".
	async reserveActive(chatId: string, jobId: string): Promise<boolean> {
		const result = await this.redis.set(
			this.activeKey(chatId),
			jobId,
			"EX",
			ACTIVE_RESERVATION_TTL_SECONDS,
			"NX",
		);

		return result === "OK";
	}

	// Release the busy flag only if this same job owns it.
	async releaseActive(chatId: string, jobId: string): Promise<boolean> {
		const result = await this.redis.eval(
			COMPARE_AND_DELETE_ACTIVE_SCRIPT,
			1,
			this.activeKey(chatId),
			jobId,
		);

		return result === 1;
	}

	// Read missed events after a browser reconnect.
	async readReplay(
		chatId: string,
		lastEventId: string,
	): Promise<ChatStreamEntry[]> {
		const rows = await this.redis.xrange(
			this.streamKey(chatId),
			`(${lastEventId}`,
			"+",
		);

		return this.parseRows(rows);
	}

	// Find the newest event id. Fresh streams start here.
	async currentCursor(chatId: string): Promise<string> {
		const rows = await this.redis.xrevrange(
			this.streamKey(chatId),
			"+",
			"-",
			"COUNT",
			1,
		);

		return rows[0]?.[0] ?? "0-0";
	}

	// Wait for new events after `cursor`.
	async readLive(
		client: BlockingRedisClient,
		chatId: string,
		cursor: string,
		blockMs: number,
	): Promise<ChatStreamEntry[]> {
		const response = await client.xread(
			"BLOCK",
			blockMs,
			"STREAMS",
			this.streamKey(chatId),
			cursor,
		);

		// null means timeout with no new event.
		if (!response) {
			return [];
		}

		// ioredis returns [[streamKey, rows]].
		const [, rows] = response[0] ?? [];

		return rows ? this.parseRows(rows) : [];
	}

	// Redis key for one chat's event stream.
	private streamKey(chatId: string) {
		return `chat:${chatId}:events`;
	}

	// Redis key for one chat's busy flag.
	private activeKey(chatId: string) {
		return `chat:${chatId}:active`;
	}

	// Convert raw Redis rows into valid app events. Bad rows are skipped.
	private parseRows(rows: Array<[string, string[]]>): ChatStreamEntry[] {
		const entries: ChatStreamEntry[] = [];

		for (const [id, fields] of rows) {
			// Redis fields are stored like ["field", "value", ...].
			const payload = this.fieldValue(fields, EVENT_FIELD);

			if (!payload) {
				continue;
			}

			const event = this.parseEvent(payload);

			if (event) {
				entries.push({ event, id });
			}
		}

		return entries;
	}

	// Find one field in Redis' ["key", "value"] array.
	private fieldValue(fields: string[], field: string): string | null {
		for (let index = 0; index < fields.length; index += 2) {
			if (fields[index] === field) {
				return fields[index + 1] ?? null;
			}
		}

		return null;
	}

	// Parse JSON and make sure it matches the shared stream event contract.
	private parseEvent(payload: string): ChatStreamEvent | null {
		try {
			const result = chatStreamEventSchema.safeParse(JSON.parse(payload));

			return result.success ? result.data : null;
		} catch {
			// Ignore bad Redis data instead of killing the whole stream.
			return null;
		}
	}
}

// Shared key/TTL helpers for tests.
export const chatEventRedisKeys = {
	active: (chatId: string) => `chat:${chatId}:active`,
	stream: (chatId: string) => `chat:${chatId}:events`,
	streamTtlSeconds: STREAM_TTL_SECONDS,
	activeTtlSeconds: ACTIVE_TTL_SECONDS,
	activeReservationTtlSeconds: ACTIVE_RESERVATION_TTL_SECONDS,
	eventField: EVENT_FIELD,
} as const;
