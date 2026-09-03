import { NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type {
	AdminChatDetail,
	AdminChatMessagesResponse,
	PaginationQuery,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { AdminAuditRepository } from "../../infrastructure/persistence/admin-audit.repository";
import type { AdminConversationsRepository } from "../../infrastructure/persistence/admin-conversations.repository";
import { AdminConversationsService } from "./admin-conversations.service";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const QUERY: PaginationQuery = { page: 1, pageSize: 50 };

function chatDetail(): AdminChatDetail {
	return {
		chat: {
			createdAt: "2026-08-01T10:00:00.000Z",
			id: CHAT_ID,
			updatedAt: "2026-08-02T10:00:00.000Z",
		},
		cacheReadTokens: 10,
		cacheWriteTokens: 2,
		failedTurnCount: 1,
		messageCount: 2,
		owner: {
			email: "owner@example.com",
			id: "user_1",
			image: null,
			name: "Owner",
		},
		project: {
			id: "22222222-2222-4222-8222-222222222222",
			name: "Project",
		},
		totalCostUsdMicros: 1_000,
		totalCreditsCenti: 25,
		totalTokens: 25,
		usageSummary: [
			{
				cacheReadTokens: 10,
				cacheWriteTokens: 2,
				calls: 1,
				costUsdMicros: 1_000,
				creditsCenti: 25,
				inputTokens: 20,
				model: "anthropic/claude-sonnet",
				operation: "chat",
				outputTokens: 5,
			},
		],
	};
}

function messagesPage(): AdminChatMessagesResponse {
	return {
		items: [
			{
				createdAt: "2026-08-02T10:00:00.000Z",
				failure: null,
				id: "message_1",
				metadata: {
					model: "anthropic/claude-sonnet",
					provider: "anthropic",
					usage: { inputTokens: 12, outputTokens: 3, totalTokens: 15 },
					selectedTarget: {
						excerpt: "Private jane.doe@example.com",
						tag: "section",
						wid: "target-1",
					},
					unexpected: { prompt: "private prompt" },
				},
				parts: [
					{
						text: "Email jane.doe@example.com or call +213 555 123 456 or (415) 555-2671. Keep date 2026-08-30 and id 1234567890.",
						type: "text",
					},
					{
						errorText: "Failed for sales@example.org at https://internal.test",
						input: {
							apiKey: "sk-test-secret",
							contact: "sales@example.org",
							nested: ["020 7946 0958"],
						},
						state: "output-error",
						type: "tool-contact",
					},
				],
				role: "user",
				sentryEventId: "event-1",
				seq: 1,
			},
		],
		page: 1,
		pageSize: 50,
		total: 1,
	};
}

function viewer(role: AuthUser["role"]) {
	return {
		admin: { id: "admin_1", role },
		requestId: "request_1",
	};
}

function setup(options: { detail?: AdminChatDetail | null } = {}) {
	const conversationsRepository = {
		getChatDetail: vi
			.fn()
			.mockResolvedValue(
				options.detail === undefined ? chatDetail() : options.detail,
			),
		getGenerationAttempt: vi.fn(),
		listAiFailures: vi.fn(),
		listChatCalls: vi.fn(),
		listChatMessages: vi.fn().mockResolvedValue(messagesPage()),
		listProjectChats: vi.fn(),
		listUserChats: vi.fn(),
	};
	const auditRepository = {
		insertConversationViewIfAbsent: vi.fn().mockResolvedValue(undefined),
	};
	const service = new AdminConversationsService(
		conversationsRepository as unknown as AdminConversationsRepository,
		auditRepository as unknown as AdminAuditRepository,
	);

	return { auditRepository, conversationsRepository, service };
}

describe("AdminConversationsService", () => {
	it("returns the reduced transcript and safe metadata without read-raw", async () => {
		const { service } = setup();

		const result = await service.listChatMessages(
			CHAT_ID,
			QUERY,
			viewer("support"),
		);

		expect(result.items[0]?.parts).toEqual([
			{
				text: "Email [redacted] or call [redacted] or [redacted]. Keep date 2026-08-30 and id 1234567890.",
				type: "text",
			},
			{
				errorText: "Failed for  at",
				state: "output-error",
				toolName: "contact",
				type: "tool-contact",
			},
		]);
		expect(result.items[0]?.metadata).toEqual({
			model: "anthropic/claude-sonnet",
			provider: "anthropic",
			usage: { inputTokens: 12, outputTokens: 3, totalTokens: 15 },
		});
	});

	it("returns full tool JSON with credential-like strings masked for read-raw", async () => {
		const { service } = setup();

		const result = await service.listChatMessages(
			CHAT_ID,
			QUERY,
			viewer("admin"),
		);

		expect(result.items[0]?.parts).toEqual([
			messagesPage().items[0]?.parts[0],
			{
				errorText: "Failed for sales@example.org at https://internal.test",
				input: {
					apiKey: "[redacted]",
					contact: "sales@example.org",
					nested: ["020 7946 0958"],
				},
				state: "output-error",
				type: "tool-contact",
			},
		]);
		expect(result.items[0]?.metadata).toEqual(
			messagesPage().items[0]?.metadata,
		);
	});

	it("delegates every transcript read to the atomic audit dedupe statement", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
		const { auditRepository, service } = setup();

		try {
			await service.listChatMessages(CHAT_ID, QUERY, viewer("support"));
			await service.listChatMessages(
				CHAT_ID,
				{ page: 2, pageSize: 50 },
				viewer("support"),
			);

			expect(
				auditRepository.insertConversationViewIfAbsent,
			).toHaveBeenCalledTimes(2);
			expect(
				auditRepository.insertConversationViewIfAbsent,
			).toHaveBeenCalledWith(
				{
					adminUserId: "admin_1",
					requestId: "request_1",
					targetId: CHAT_ID,
					targetUserId: "user_1",
				},
				new Date("2026-08-30T11:45:00.000Z"),
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("returns 404 for a missing chat", async () => {
		const { service } = setup({ detail: null });

		await expect(service.getChatDetail(CHAT_ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(
			service.listChatMessages(CHAT_ID, QUERY, viewer("support")),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("returns 404 for a missing generation attempt", async () => {
		const { conversationsRepository, service } = setup();
		conversationsRepository.getGenerationAttempt.mockResolvedValue(null);

		await expect(
			service.getGenerationAttempt("image", "attempt_1"),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
