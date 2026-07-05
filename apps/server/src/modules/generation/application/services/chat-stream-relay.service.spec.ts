import { EventEmitter } from "node:events";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { ChatEventsRepository } from "../../infrastructure/redis/chat-events.repository";
import { ChatStreamRelayService } from "./chat-stream-relay.service";

describe("ChatStreamRelayService", () => {
	it("replays entries after Last-Event-ID and then relays live entries", async () => {
		const requestRaw = new EventEmitter();
		const chunks: string[] = [];
		const raw = {
			destroyed: false,
			end: vi.fn(() => {
				raw.destroyed = true;
			}),
			flushHeaders: vi.fn(),
			write: vi.fn((chunk: string) => {
				chunks.push(chunk);
				return true;
			}),
			writeHead: vi.fn(),
		};
		const client = {};
		let liveReads = 0;
		const repository = {
			closeBlockingClient: vi.fn(async () => "OK"),
			createBlockingClient: vi.fn(() => client),
			currentCursor: vi.fn(async () => "0-0"),
			readLive: vi.fn(async () => {
				liveReads += 1;

				if (liveReads === 1) {
					return [
						{
							event: {
								delta: " live",
								messageId: "message_1",
								type: "delta",
							},
							id: "3-0",
						},
					];
				}

				requestRaw.emit("close");
				return [];
			}),
			readReplay: vi.fn(async () => [
				{
					event: {
						delta: "replay",
						messageId: "message_1",
						type: "delta",
					},
					id: "2-0",
				},
			]),
		};
		const service = new ChatStreamRelayService(
			repository as unknown as ChatEventsRepository,
		);

		await service.relay({
			chatId: "chat_1",
			lastEventId: "1-0",
			reply: {
				hijack: vi.fn(),
				raw,
			} as unknown as FastifyReply,
			request: {
				headers: {},
				raw: requestRaw,
			} as unknown as FastifyRequest,
		});

		expect(repository.readReplay).toHaveBeenCalledWith("chat_1", "1-0");
		expect(repository.readLive).toHaveBeenCalledWith(
			client,
			"chat_1",
			"2-0",
			expect.any(Number),
		);
		expect(chunks.join("")).toContain("id: 2-0");
		expect(chunks.join("")).toContain("id: 3-0");
		expect(repository.closeBlockingClient).toHaveBeenCalledWith(client);
		expect(raw.end).toHaveBeenCalled();
	});

	it("adds CORS headers to the hijacked reply for the allowed origin", async () => {
		const requestRaw = new EventEmitter();
		const raw = {
			destroyed: false,
			end: vi.fn(() => {
				raw.destroyed = true;
			}),
			flushHeaders: vi.fn(),
			write: vi.fn(() => true),
			writeHead: vi.fn(),
		};
		const client = {
			disconnect: vi.fn(),
		};
		const repository = {
			closeBlockingClient: vi.fn(),
			createBlockingClient: vi.fn(() => client),
			currentCursor: vi.fn(async () => {
				requestRaw.emit("close");
				return "0-0";
			}),
			readLive: vi.fn(async () => []),
			readReplay: vi.fn(async () => []),
		};
		const service = new ChatStreamRelayService(
			repository as unknown as ChatEventsRepository,
		);

		await service.relay({
			chatId: "chat_1",
			reply: {
				hijack: vi.fn(),
				raw,
			} as unknown as FastifyReply,
			request: {
				headers: {
					origin: "http://web.test",
				},
				raw: requestRaw,
			} as unknown as FastifyRequest,
		});

		expect(raw.writeHead).toHaveBeenCalledWith(
			200,
			expect.objectContaining({
				"Access-Control-Allow-Credentials": "true",
				"Access-Control-Allow-Origin": "http://web.test",
				Vary: "Origin",
			}),
		);
	});
});
