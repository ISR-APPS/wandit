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

const HEARTBEAT_INTERVAL_MS = 15_000;
const XREAD_BLOCK_MS = 5_000;

@Injectable()
export class ChatStreamRelayService {
	private readonly logger = new Logger(ChatStreamRelayService.name);

	constructor(
		@Inject(ChatEventsRepository)
		private readonly chatEventsRepository: ChatEventsRepository,
	) {}

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
		let cursor = lastEventId ?? "0-0";
		let client: BlockingRedisClient | null = null;

		reply.hijack();
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

		const close = () => {
			closed = true;
			client?.disconnect();
		};
		request.raw.on("close", close);
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
				cursor = await this.chatEventsRepository.currentCursor(chatId);
			}

			client = this.chatEventsRepository.createBlockingClient();

			while (!closed) {
				let entries: ChatStreamEntry[];

				try {
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

					await this.writeEntry(raw, entry);
					cursor = entry.id;
				}
			}
		} finally {
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

	private async writeEntry(
		raw: ServerResponse,
		entry: ChatStreamEntry,
	): Promise<void> {
		await this.write(raw, `id: ${entry.id}\n`);
		await this.write(raw, `event: ${entry.event.type}\n`);
		await this.write(raw, `data: ${JSON.stringify(entry.event)}\n\n`);
	}

	private writeComment(raw: ServerResponse, comment: string): Promise<void> {
		return this.write(raw, `: ${comment}\n\n`);
	}

	private async write(raw: ServerResponse, chunk: string): Promise<void> {
		if (raw.destroyed || raw.write(chunk)) {
			return;
		}

		await Promise.race([once(raw, "drain"), once(raw, "close")]);
	}

	private allowedCorsOrigin(request: FastifyRequest): string | undefined {
		const origin = request.headers.origin;

		return typeof origin === "string" &&
			typeof env.CORS_ORIGIN === "string" &&
			origin === env.CORS_ORIGIN
			? origin
			: undefined;
	}
}
