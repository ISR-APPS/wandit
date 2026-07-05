import { BadRequestException } from "@nestjs/common";
import { sendChatMessageBodySchema } from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { ChatService } from "../../../application/services/chat.service";
import type { ChatStreamRelayService } from "../../../application/services/chat-stream-relay.service";
import { ChatsController } from "./chats.controller";

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

const user = {
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	email: "user@example.com",
	emailVerified: true,
	id: "user_1",
	name: "User",
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies Parameters<ChatsController["stream"]>[1];

describe("ChatsController", () => {
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

		expect(
			sendChatMessageBodySchema.parse({
				composer: {
					mode: "marketing",
				},
				text: "Write campaign hooks",
			}).composer?.quality,
		).toBe("standard");
	});

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
		expect(chatService.assertStreamAccess).not.toHaveBeenCalled();
		expect(relay.relay).not.toHaveBeenCalled();
	});

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
		expect(chatService.assertStreamAccess).not.toHaveBeenCalled();
		expect(relay.relay).not.toHaveBeenCalled();
	});
});
