import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { ChatMessage, ChatStreamEvent } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "./redis-connection";

const STREAM_TTL_SECONDS = 24 * 60 * 60;
const ACTIVE_TTL_SECONDS = 15 * 60;
const EVENT_FIELD = "event";
const PUBLISHER_REDIS_COMMAND_TIMEOUT_MS = 8_000;
const PUBLISHER_REDIS_MAX_RETRIES_PER_REQUEST = 2;
const COMPARE_AND_REFRESH_ACTIVE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
end
return nil
`;
const COMPARE_AND_DELETE_ACTIVE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`;

@Injectable()
export class ChatEventsPublisher implements OnModuleDestroy {
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: PUBLISHER_REDIS_COMMAND_TIMEOUT_MS,
			maxRetriesPerRequest: PUBLISHER_REDIS_MAX_RETRIES_PER_REQUEST,
		}),
	);

	async onModuleDestroy() {
		await this.redis.quit();
	}

	async markStarted(chatId: string, jobId: string): Promise<void> {
		await this.redis.set(
			this.activeKey(chatId),
			jobId,
			"EX",
			ACTIVE_TTL_SECONDS,
		);
		await this.publish(chatId, {
			status: "started",
			type: "status",
		});
	}

	async publishThinking(chatId: string): Promise<void> {
		await this.publish(chatId, {
			status: "thinking",
			type: "status",
		});
	}

	async publishDelta(input: {
		chatId: string;
		delta: string;
		jobId: string;
		messageId: string;
	}): Promise<void> {
		await this.refreshActive(input.chatId, input.jobId);
		await this.publish(input.chatId, {
			delta: input.delta,
			messageId: input.messageId,
			type: "delta",
		});
	}

	async publishMessageCompleted(
		chatId: string,
		message: ChatMessage,
	): Promise<void> {
		await this.publish(chatId, {
			message,
			type: "message-completed",
		});
	}

	async publishError(
		chatId: string,
		error: { code: string; message: string },
	): Promise<void> {
		await this.publish(chatId, {
			code: error.code,
			message: error.message,
			type: "error",
		});
	}

	async publishDone(chatId: string, jobId: string): Promise<void> {
		await this.publish(chatId, {
			jobId,
			type: "done",
		});
	}

	async clearActive(chatId: string, jobId: string): Promise<boolean> {
		const result = await this.redis.eval(
			COMPARE_AND_DELETE_ACTIVE_SCRIPT,
			1,
			this.activeKey(chatId),
			jobId,
		);

		return result === 1;
	}

	private async refreshActive(chatId: string, jobId: string): Promise<void> {
		await this.redis.eval(
			COMPARE_AND_REFRESH_ACTIVE_SCRIPT,
			1,
			this.activeKey(chatId),
			jobId,
			String(ACTIVE_TTL_SECONDS),
		);
	}

	private async publish(chatId: string, event: ChatStreamEvent): Promise<void> {
		const streamKey = this.streamKey(chatId);

		await this.redis.xadd(streamKey, "*", EVENT_FIELD, JSON.stringify(event));
		await this.redis.expire(streamKey, STREAM_TTL_SECONDS);
	}

	private streamKey(chatId: string) {
		return `chat:${chatId}:events`;
	}

	private activeKey(chatId: string) {
		return `chat:${chatId}:active`;
	}
}
