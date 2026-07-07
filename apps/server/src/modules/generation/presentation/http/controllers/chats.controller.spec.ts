/**
 * Tests for the chat HTTP controller.
 *
 * These tests check request-boundary rules before work reaches the services.
 */
import { BadRequestException } from "@nestjs/common";
// Shared Zod schema used by frontend and API.
import { sendChatMessageBodySchema } from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { ChatService } from "../../../application/services/chat.service";
import type { ChatStreamRelayService } from "../../../application/services/chat-stream-relay.service";
import { ChatsController } from "./chats.controller";

// Build the controller with fake services.
function setup() {
	const chatService = {
		assertStreamAccess: vi.fn(),
	};
	const relay = {
		relay: vi.fn(),
	};
	const controller = new ChatsController(
		chatService as unknown as ChatService,
		relay as unknown as ChatStreamRelayService,
	);

	return { chatService, controller, relay };
}

// Fake logged-in user for controller method calls.
const user = {
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	email: "user@example.com",
	emailVerified: true,
	id: "user_1",
	name: "User",
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies Parameters<ChatsController["stream"]>[1];

// Test controller validation.
describe("ChatsController", () => {
	// Composer quality defaults to "standard" if omitted.
	it("validates composer quality and defaults it to standard", () => {
		expect(
			sendChatMessageBodySchema.parse({
				composer: {
					mode: "marketing",
					quality: "max",
				},
				text: "Write campaign hooks",
			}).composer?.quality,
		).toBe("max");

		// The default comes from the shared schema.
		expect(
			sendChatMessageBodySchema.parse({
				composer: {
					mode: "marketing",
				},
				text: "Write campaign hooks",
			}).composer?.quality,
		).toBe("standard");
	});

	// Bad query cursor should fail before opening SSE.
	it("rejects an invalid query lastEventId before stream setup", async () => {
		const { chatService, controller, relay } = setup();

		await expect(
			controller.stream(
				"00000000-0000-0000-0000-000000000001",
				user,
				{ headers: {} } as unknown as FastifyRequest,
				{} as FastifyReply,
				"garbage",
			),
		).rejects.toBeInstanceOf(BadRequestException);
		// No service work should happen after invalid cursor.
		expect(chatService.assertStreamAccess).not.toHaveBeenCalled();
		expect(relay.relay).not.toHaveBeenCalled();
	});

	// Bad Last-Event-ID header should fail before opening SSE.
	it("rejects an invalid Last-Event-ID header before stream setup", async () => {
		const { chatService, controller, relay } = setup();

		await expect(
			controller.stream(
				"00000000-0000-0000-0000-000000000001",
				user,
				{
					headers: {
						"last-event-id": "bad-header",
					},
				} as unknown as FastifyRequest,
				{} as FastifyReply,
			),
		).rejects.toBeInstanceOf(BadRequestException);
		// No service work should happen after invalid cursor.
		expect(chatService.assertStreamAccess).not.toHaveBeenCalled();
		expect(relay.relay).not.toHaveBeenCalled();
	});
});
