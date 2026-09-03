/**
 * Tests for the chat HTTP controller.
 *
 * These tests check request-boundary rules before work reaches the services.
 */
import { BadRequestException, NotFoundException } from "@nestjs/common";
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
		getUsage: vi.fn(),
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
	banned: false,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	email: "user@example.com",
	emailVerified: true,
	id: "user_1",
	name: "User",
	role: "user",
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies Parameters<ChatsController["stream"]>[1];

const staffUser = {
	...user,
	role: "support",
} satisfies Parameters<ChatsController["getUsage"]>[1];

// Test controller validation.
describe("ChatsController", () => {
	it("hides conversation usage from non-staff users", () => {
		const { chatService, controller } = setup();

		expect(() =>
			controller.getUsage("00000000-0000-0000-0000-000000000001", user, {
				kind: "personal",
			}),
		).toThrow(NotFoundException);
		expect(chatService.getUsage).not.toHaveBeenCalled();
	});

	it("returns usage to staff within the current workspace scope", async () => {
		const { chatService, controller } = setup();
		const usage = {
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 10,
			cacheWriteTokens: 5,
			costUsdMicros: 130_000,
			creditsCenti: 325,
		};
		chatService.getUsage.mockResolvedValue(usage);

		await expect(
			controller.getUsage("00000000-0000-0000-0000-000000000001", staffUser, {
				kind: "org",
				organizationId: "org_1",
				role: "member",
				roles: ["member"],
			}),
		).resolves.toEqual(usage);
		expect(chatService.getUsage).toHaveBeenCalledWith(
			{
				actorIsLimitExempt: false,
				kind: "org",
				organizationId: "org_1",
				userId: "user_1",
			},
			"00000000-0000-0000-0000-000000000001",
		);
	});

	// Zod strips the retired field, so old clients remain wire-compatible.
	it("accepts and strips a legacy composer quality", () => {
		const parsed = sendChatMessageBodySchema.parse({
			composer: {
				mode: "marketing",
				quality: "max",
			},
			text: "Write campaign hooks",
		});

		expect(parsed.composer).toEqual({ mode: "marketing" });
		expect(parsed.composer).not.toHaveProperty("quality");
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
