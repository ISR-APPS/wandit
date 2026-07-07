/**
 * Tests for the SSE relay.
 *
 * The relay reads events from Redis and writes SSE text to the browser.
 * These tests use fake request/reply objects, so no real HTTP server is needed.
 */
import { EventEmitter } from "node:events";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { ChatEventsRepository } from "../../infrastructure/redis/chat-events.repository";
import { ChatStreamRelayService } from "./chat-stream-relay.service";

// Test the important order: replay missed events, then read live events.
describe("ChatStreamRelayService", () => {
	// Reconnect should replay missed events before live events.
	it("replays entries after Last-Event-ID and then relays live entries", async () => {
		// The relay listens for "close" to know the browser disconnected.
		const requestRaw = new EventEmitter();
		// Capture the SSE text that would be sent to the browser.
		const chunks: string[] = [];
		// Fake raw response object.
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
		// Fake Redis blocking client.
		const client = {};
		let liveReads = 0;
		// Fake repository: one replay event, one live event, then close.
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

				// Close so the relay loop can finish.
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

		// Replay starts after the cursor from the browser.
		expect(repository.readReplay).toHaveBeenCalledWith("chat_1", "1-0");
		// Live read starts after the replayed entry, not before it.
		expect(repository.readLive).toHaveBeenCalledWith(
			client,
			"chat_1",
			"2-0",
			expect.any(Number),
		);
		// SSE text includes event ids for future reconnects.
		expect(chunks.join("")).toContain("id: 2-0");
		expect(chunks.join("")).toContain("id: 3-0");
		// The extra Redis client must be closed.
		expect(repository.closeBlockingClient).toHaveBeenCalledWith(client);
		expect(raw.end).toHaveBeenCalled();
	});

	// SSE bypasses normal JSON handling, so it must write its own CORS headers.
	it("adds CORS headers to the hijacked reply for the allowed origin", async () => {
		const requestRaw = new EventEmitter();
		// Fake response only needs enough fields to inspect headers.
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
		// Close immediately so the test does not wait for Redis timeout.
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

		// Credentialed EventSource needs exact origin + credentials header.
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
