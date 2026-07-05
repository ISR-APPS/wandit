import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { type ChatStreamEvent, chatStreamEventSchema } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";

const STREAM_TTL_SECONDS = 24 * 60 * 60;
const ACTIVE_TTL_SECONDS = 15 * 60;
const ACTIVE_RESERVATION_TTL_SECONDS = 60;
const EVENT_FIELD = "event";
const XREAD_COMMAND_TIMEOUT_MS = 8_000;
const API_REDIS_MAX_RETRIES_PER_REQUEST = 2;
const COMPARE_AND_DELETE_ACTIVE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`;

export type ChatStreamEntry = {
	event: ChatStreamEvent;
	id: string;
};

export type BlockingRedisClient = Redis;

@Injectable()
export class ChatEventsRepository implements OnModuleDestroy {
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: XREAD_COMMAND_TIMEOUT_MS,
			lazyConnect: true,
			maxRetriesPerRequest: API_REDIS_MAX_RETRIES_PER_REQUEST,
		}),
	);

	async onModuleDestroy() {
		await this.redis.quit();
	}

	createBlockingClient(): BlockingRedisClient {
		return new Redis(
			createRedisConnectionOptions(env.REDIS_URL, {
				commandTimeout: XREAD_COMMAND_TIMEOUT_MS,
				maxRetriesPerRequest: API_REDIS_MAX_RETRIES_PER_REQUEST,
			}),
		);
	}

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

	getActiveJobId(chatId: string): Promise<string | null> {
		return this.redis.get(this.activeKey(chatId));
	}

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

	async releaseActive(chatId: string, jobId: string): Promise<boolean> {
		const result = await this.redis.eval(
			COMPARE_AND_DELETE_ACTIVE_SCRIPT,
			1,
			this.activeKey(chatId),
			jobId,
		);

		return result === 1;
	}

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

		if (!response) {
			return [];
		}

		const [, rows] = response[0] ?? [];

		return rows ? this.parseRows(rows) : [];
	}

	private streamKey(chatId: string) {
		return `chat:${chatId}:events`;
	}

	private activeKey(chatId: string) {
		return `chat:${chatId}:active`;
	}

	private parseRows(rows: Array<[string, string[]]>): ChatStreamEntry[] {
		const entries: ChatStreamEntry[] = [];

		for (const [id, fields] of rows) {
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

	private fieldValue(fields: string[], field: string): string | null {
		for (let index = 0; index < fields.length; index += 2) {
			if (fields[index] === field) {
				return fields[index + 1] ?? null;
			}
		}

		return null;
	}

	private parseEvent(payload: string): ChatStreamEvent | null {
		try {
			const result = chatStreamEventSchema.safeParse(JSON.parse(payload));

			return result.success ? result.data : null;
		} catch {
			return null;
		}
	}
}

export const chatEventRedisKeys = {
	active: (chatId: string) => `chat:${chatId}:active`,
	stream: (chatId: string) => `chat:${chatId}:events`,
	streamTtlSeconds: STREAM_TTL_SECONDS,
	activeTtlSeconds: ACTIVE_TTL_SECONDS,
	activeReservationTtlSeconds: ACTIVE_RESERVATION_TTL_SECONDS,
	eventField: EVENT_FIELD,
} as const;
