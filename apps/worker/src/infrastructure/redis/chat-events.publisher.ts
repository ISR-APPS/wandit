// Worker-side Redis publisher for chat events.
//
// The worker writes events here:
// - status
// - delta
// - message-completed
// - error
// - done
//
// The API reads these Redis Stream events and sends them to the browser as SSE.
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { ChatMessage, ChatStreamEvent } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "./redis-connection";

// Keep stream events long enough for reconnects, but not forever.
const STREAM_TTL_SECONDS = 24 * 60 * 60;
// Busy flag TTL. If worker crashes, Redis eventually clears it.
const ACTIVE_TTL_SECONDS = 15 * 60;
// Field name used for the JSON payload inside each Redis Stream entry.
const EVENT_FIELD = "event";
const PUBLISHER_REDIS_COMMAND_TIMEOUT_MS = 8_000;
const PUBLISHER_REDIS_MAX_RETRIES_PER_REQUEST = 2;
// Lua script: refresh the busy flag only if this job still owns it.
const COMPARE_AND_REFRESH_ACTIVE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
end
return nil
`;
// Lua script: delete the busy flag only if this job still owns it.
const COMPARE_AND_DELETE_ACTIVE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`;

// `@Injectable()` lets processors inject this publisher.
@Injectable()
export class ChatEventsPublisher implements OnModuleDestroy {
	// Redis client used for publisher writes.
	private readonly redis = new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: PUBLISHER_REDIS_COMMAND_TIMEOUT_MS,
			maxRetriesPerRequest: PUBLISHER_REDIS_MAX_RETRIES_PER_REQUEST,
		}),
	);

	// Close Redis when Nest shuts down.
	async onModuleDestroy() {
		await this.redis.quit();
	}

	// Mark the chat as busy and publish "started".
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

	// Publish "thinking" before text deltas start.
	async publishThinking(chatId: string): Promise<void> {
		await this.publish(chatId, {
			status: "thinking",
			type: "status",
		});
	}

	// Publish one small piece of assistant text.
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

	// Publish the final saved assistant message.
	async publishMessageCompleted(
		chatId: string,
		message: ChatMessage,
	): Promise<void> {
		await this.publish(chatId, {
			message,
			type: "message-completed",
		});
	}

	// Publish a generation error for the chat UI.
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

	// Publish final "done" event so the UI can stop showing busy state.
	async publishDone(chatId: string, jobId: string): Promise<void> {
		await this.publish(chatId, {
			jobId,
			type: "done",
		});
	}

	// Clear the busy flag only if this job still owns it.
	async clearActive(chatId: string, jobId: string): Promise<boolean> {
		const result = await this.redis.eval(
			COMPARE_AND_DELETE_ACTIVE_SCRIPT,
			1,
			this.activeKey(chatId),
			jobId,
		);

		return result === 1;
	}

	// Keep the busy flag alive while this job is streaming.
	private async refreshActive(chatId: string, jobId: string): Promise<void> {
		await this.redis.eval(
			COMPARE_AND_REFRESH_ACTIVE_SCRIPT,
			1,
			this.activeKey(chatId),
			jobId,
			String(ACTIVE_TTL_SECONDS),
		);
	}

	// Append one event to the Redis Stream.
	private async publish(chatId: string, event: ChatStreamEvent): Promise<void> {
		const streamKey = this.streamKey(chatId);

		// xadd appends an event. expire keeps the stream from living forever.
		await this.redis.xadd(streamKey, "*", EVENT_FIELD, JSON.stringify(event));
		await this.redis.expire(streamKey, STREAM_TTL_SECONDS);
	}

	// Redis key for one chat's event stream.
	private streamKey(chatId: string) {
		return `chat:${chatId}:events`;
	}

	// Redis key for one chat's busy flag.
	private activeKey(chatId: string) {
		return `chat:${chatId}:active`;
	}
}
