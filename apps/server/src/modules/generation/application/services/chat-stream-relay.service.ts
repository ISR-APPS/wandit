/**
 * Sends Redis chat events to the browser as SSE.
 *
 * SSE means the browser keeps one HTTP request open, and the server keeps
 * writing small events into it. This is how the chat shows live AI text.
 *
 * The worker writes events into Redis Streams. This service reads those events
 * and writes them to the browser response.
 */
import { once } from "node:events";
import type { ServerResponse } from "node:http";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
	type BlockingRedisClient,
	ChatEventsRepository,
	type ChatStreamEntry,
} from "../../infrastructure/redis/chat-events.repository";

// Heartbeats are small ignored messages that keep the connection alive.
const HEARTBEAT_INTERVAL_MS = 15_000;
// How long Redis should wait for new events before checking if the browser left.
const XREAD_BLOCK_MS = 5_000;

// `@Injectable()` lets the controller inject this service.
@Injectable()
export class ChatStreamRelayService {
	private readonly logger = new Logger(ChatStreamRelayService.name);

	constructor(
		// Repository reads/parses Redis. This service writes HTTP/SSE bytes.
		@Inject(ChatEventsRepository)
		private readonly chatEventsRepository: ChatEventsRepository,
	) {}

	// Open one long-running response for one chat.
	async relay(options: {
		chatId: string;
		lastEventId?: string;
		reply: FastifyReply;
		request: FastifyRequest;
	}): Promise<void> {
		const { chatId, lastEventId, reply, request } = options;
		const raw = reply.raw;
		const allowedCorsOrigin = this.allowedCorsOrigin(request);
		let closed = false;
		// Cursor is the last Redis event id we already sent to the browser.
		let cursor = lastEventId ?? "0-0";
		let client: BlockingRedisClient | null = null;

		// `hijack()` means "Nest, do not make JSON; I will write the response myself."
		reply.hijack();
		// Headers required for EventSource/SSE.
		raw.writeHead(200, {
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"Content-Type": "text/event-stream; charset=utf-8",
			...(allowedCorsOrigin
				? {
						"Access-Control-Allow-Credentials": "true",
						"Access-Control-Allow-Origin": allowedCorsOrigin,
						Vary: "Origin",
					}
				: {}),
			"X-Accel-Buffering": "no",
		});
		raw.flushHeaders?.();
		await this.writeComment(raw, "connected");

		// If the browser closes the tab, stop Redis reads and exit the loop.
		const close = () => {
			closed = true;
			client?.disconnect();
		};
		request.raw.on("close", close);
		// Send heartbeat comments while waiting for real model text.
		const heartbeat = setInterval(() => {
			if (!closed) {
				void this.writeComment(raw, "heartbeat").catch((error) => {
					this.logger.warn(
						`Stopping chat stream heartbeat for ${chatId}: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
					closed = true;
					client?.disconnect();
				});
			}
		}, HEARTBEAT_INTERVAL_MS);

		try {
			if (lastEventId) {
				// Reconnect path: replay events the browser missed.
				const replayEntries = await this.chatEventsRepository.readReplay(
					chatId,
					lastEventId,
				);

				for (const entry of replayEntries) {
					if (closed) {
						break;
					}

					await this.writeEntry(raw, entry);
					cursor = entry.id;
				}
			} else {
				// Fresh path: start at the current end so old deltas are not duplicated.
				cursor = await this.chatEventsRepository.currentCursor(chatId);
			}

			// Use a separate Redis connection because XREAD can wait/block.
			client = this.chatEventsRepository.createBlockingClient();

			while (!closed) {
				let entries: ChatStreamEntry[];

				try {
					// Wait for new Redis events after the current cursor.
					entries = await this.chatEventsRepository.readLive(
						client,
						chatId,
						cursor,
						XREAD_BLOCK_MS,
					);
				} catch (error) {
					if (!closed) {
						this.logger.warn(
							`Stopping chat stream for ${chatId} after Redis read error: ${
								error instanceof Error ? error.message : String(error)
							}`,
						);
					}

					closed = true;
					break;
				}

				for (const entry of entries) {
					if (closed) {
						break;
					}

					// Send the event, then move the cursor forward.
					await this.writeEntry(raw, entry);
					cursor = entry.id;
				}
			}
		} finally {
			// Always stop the heartbeat and close the extra Redis client.
			clearInterval(heartbeat);
			request.raw.off("close", close);

			if (client) {
				await this.chatEventsRepository.closeBlockingClient(client);
			}

			if (!raw.destroyed) {
				raw.end();
			}
		}
	}

	// Format one Redis event as an SSE frame.
	private async writeEntry(
		raw: ServerResponse,
		entry: ChatStreamEntry,
	): Promise<void> {
		await this.write(raw, `id: ${entry.id}\n`);
		await this.write(raw, `event: ${entry.event.type}\n`);
		await this.write(raw, `data: ${JSON.stringify(entry.event)}\n\n`);
	}

	// SSE comments start with ":" and are ignored by browser code.
	private writeComment(raw: ServerResponse, comment: string): Promise<void> {
		return this.write(raw, `: ${comment}\n\n`);
	}

	// If the browser is slow, wait instead of buffering unlimited data in memory.
	private async write(raw: ServerResponse, chunk: string): Promise<void> {
		if (raw.destroyed || raw.write(chunk)) {
			return;
		}

		// Continue when the response can accept more data, or stop when it closes.
		await Promise.race([once(raw, "drain"), once(raw, "close")]);
	}

	// If EventSource sends cookies, CORS must echo the exact allowed origin.
	private allowedCorsOrigin(request: FastifyRequest): string | undefined {
		const origin = request.headers.origin;

		return typeof origin === "string" &&
			typeof env.CORS_ORIGIN === "string" &&
			origin === env.CORS_ORIGIN
			? origin
			: undefined;
	}
}
