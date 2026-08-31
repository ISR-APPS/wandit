import { adminRoutes } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api-client";

import {
	getChatDetail,
	getGenerationAttempt,
	listAiFailures,
	listChatCalls,
	listChatMessages,
	listProjectChats,
	listUserChats,
} from "./conversations.services";

vi.mock("@/lib/api-client", () => ({
	apiGet: vi.fn(),
}));

const apiGetMock = vi.mocked(apiGet);
const chatId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const usageId = "33333333-3333-4333-8333-333333333333";
const createdAt = "2026-08-29T10:15:00.000Z";
const updatedAt = "2026-08-29T10:20:00.000Z";

const owner = {
	id: "user-1",
	name: "Nadia Founder",
	email: "nadia@example.com",
	image: null,
};

const chatSummary = {
	id: chatId,
	projectId,
	projectName: "Launch site",
	messageCount: 4,
	failedTurnCount: 1,
	lastMessageAt: updatedAt,
	createdAt,
	owner,
};

const page = {
	items: [chatSummary],
	page: 1,
	pageSize: 20,
	total: 1,
};

const failure = {
	kind: "rate_limited" as const,
	source: "gateway" as const,
	providerLabel: "Anthropic",
	retryable: true,
	terminal: true,
	refunded: null,
	moderationStage: null,
	providerMessage: null,
	requestId: "gen_request_1",
};

afterEach(() => {
	vi.clearAllMocks();
});

describe("admin conversation services", () => {
	it("parses project and user chat list schemas and applies page defaults", async () => {
		apiGetMock.mockResolvedValueOnce(page).mockResolvedValueOnce(page);

		await expect(listProjectChats({ projectId })).resolves.toEqual(page);
		await expect(listUserChats({ userId: "user-1" })).resolves.toEqual(page);

		expect(apiGetMock).toHaveBeenNthCalledWith(
			1,
			adminRoutes.projectChats(projectId),
			{ page: 1, pageSize: 20 },
		);
		expect(apiGetMock).toHaveBeenNthCalledWith(
			2,
			adminRoutes.userChats("user-1"),
			{ page: 1, pageSize: 20 },
		);
	});

	it("parses chat detail, message, and call schemas", async () => {
		const detail = {
			chat: { id: chatId, createdAt, updatedAt },
			project: { id: projectId, name: "Launch site" },
			owner,
			messageCount: 4,
			failedTurnCount: 1,
			totalTokens: 1_250,
			totalCostUsdMicros: 125_000,
		};
		const messages = {
			items: [
				{
					id: "message-1",
					role: "assistant",
					seq: 2,
					createdAt,
					parts: [{ type: "text", text: "Contact [redacted] for help." }],
					metadata: { provider: "anthropic" },
					failure,
					sentryEventId: "event-1",
				},
			],
			page: 1,
			pageSize: 50,
			total: 1,
		};
		const calls = {
			items: [
				{
					id: usageId,
					operation: "chat",
					model: "anthropic/claude-sonnet",
					provider: "anthropic",
					inputTokens: 800,
					outputTokens: 450,
					totalTokens: 1_250,
					costUsd: 0.125,
					messageId: "message-1",
					gatewayGenerationId: "gen_1",
					createdAt,
				},
			],
			page: 1,
			pageSize: 20,
			total: 1,
		};

		apiGetMock
			.mockResolvedValueOnce(detail)
			.mockResolvedValueOnce(messages)
			.mockResolvedValueOnce(calls);

		await expect(getChatDetail(chatId)).resolves.toEqual(detail);
		await expect(
			listChatMessages({ chatId, page: 1, pageSize: 50 }),
		).resolves.toEqual(messages);
		await expect(
			listChatCalls({ chatId, page: 1, pageSize: 20 }),
		).resolves.toEqual(calls);

		expect(apiGetMock).toHaveBeenNthCalledWith(1, adminRoutes.chat(chatId));
		expect(apiGetMock).toHaveBeenNthCalledWith(
			2,
			adminRoutes.chatMessages(chatId),
			{ page: 1, pageSize: 50 },
		);
		expect(apiGetMock).toHaveBeenNthCalledWith(
			3,
			adminRoutes.chatCalls(chatId),
			{ page: 1, pageSize: 20 },
		);
	});

	it("serializes failure surfaces as CSV and parses the feed schema", async () => {
		const response = {
			items: [
				{
					surface: "chat",
					id: "message-1",
					chatId,
					projectId,
					userId: "user-1",
					kind: "rate_limited",
					source: "gateway",
					provider: "anthropic",
					providerMessage: null,
					requestId: "gen_request_1",
					sentryEventId: "event-1",
					createdAt,
				},
			],
			page: 2,
			pageSize: 25,
			total: 30,
		};
		apiGetMock.mockResolvedValueOnce(response);

		await expect(
			listAiFailures({
				page: 2,
				pageSize: 25,
				kind: "rate_limited",
				provider: "anthropic",
				surface: ["chat", "image"],
			}),
		).resolves.toEqual(response);

		expect(apiGetMock).toHaveBeenCalledWith(adminRoutes.aiFailures, {
			page: 2,
			pageSize: 25,
			kind: "rate_limited",
			provider: "anthropic",
			surface: "chat,image",
		});
	});

	it("validates the generation surface and parses a safe attempt detail", async () => {
		const detail = {
			surface: "image",
			id: "attempt-1",
			status: "failed",
			error: "The provider could not make this image.",
			kind: "provider_error",
			source: "gateway",
			provider: "openai",
			providerMessage: null,
			requestId: "gen_2",
			sentryEventId: "event-2",
			createdAt,
			updatedAt,
			projectId,
			userId: "user-1",
			raw: { model: "openai/gpt-image-1", triggerRunId: "run_1" },
		};
		apiGetMock.mockResolvedValueOnce(detail);

		await expect(
			getGenerationAttempt({ surface: "image", attemptId: "attempt-1" }),
		).resolves.toEqual(detail);
		expect(apiGetMock).toHaveBeenCalledWith(
			adminRoutes.generationAttempt("image", "attempt-1"),
		);
	});

	it("rejects payloads that do not match the shared schemas", async () => {
		apiGetMock.mockResolvedValueOnce({
			...page,
			items: [{ ...chatSummary, id: "bad" }],
		});

		await expect(listProjectChats({ projectId })).rejects.toThrow();
	});
});
