import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { GenerationActiveError } from "../../domain/errors/generation-active.error";
import type { ChatsRepository } from "../../infrastructure/persistence/chats.repository";
import { ChatService } from "./chat.service";
import type { GenerationActivityService } from "./generation-activity.service";
import type { GenerationPolicyService } from "./generation-policy.service";
import type { GenerationQueueService } from "./generation-queue.service";

function setup() {
	const chatsRepository = {
		deleteMessageById: vi.fn(),
		findOwnedChatById: vi.fn(),
		insertUserMessage: vi.fn(),
		listMessages: vi.fn(),
	};
	const activity = {
		getActiveJobId: vi.fn(),
		releaseActive: vi.fn(),
		reserveActive: vi.fn(),
	};
	const policy = {
		assertCanGenerate: vi.fn(),
	};
	const queue = {
		enqueueGenerateCopy: vi.fn(),
	};
	const service = new ChatService(
		chatsRepository as unknown as ChatsRepository,
		activity as unknown as GenerationActivityService,
		policy as unknown as GenerationPolicyService,
		queue as unknown as GenerationQueueService,
	);

	return { activity, chatsRepository, policy, queue, service };
}

describe("ChatService", () => {
	it("returns 404 when the chat is not owned by the caller", async () => {
		const { chatsRepository, service } = setup();
		chatsRepository.findOwnedChatById.mockResolvedValue(null);

		await expect(
			service.sendMessage("user_1", "chat_1", { text: "Hello" }),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("rejects when active generation reservation is not acquired", async () => {
		const { activity, chatsRepository, policy, queue, service } = setup();
		chatsRepository.findOwnedChatById.mockResolvedValue({
			id: "chat_1",
			projectId: "project_1",
			userId: "user_1",
		});
		activity.reserveActive.mockResolvedValue(false);

		await expect(
			service.sendMessage("user_1", "chat_1", { text: "Hello" }),
		).rejects.toBeInstanceOf(GenerationActiveError);
		expect(policy.assertCanGenerate).toHaveBeenCalledWith(
			"user_1",
			"chatMessage",
		);
		expect(chatsRepository.insertUserMessage).not.toHaveBeenCalled();
		expect(queue.enqueueGenerateCopy).not.toHaveBeenCalled();
	});

	it("persists the user message and enqueues generation", async () => {
		const { activity, chatsRepository, policy, queue, service } = setup();
		const composer = {
			mode: "marketing" as const,
			quality: "standard" as const,
			skills: ["hooks"],
		};
		chatsRepository.findOwnedChatById.mockResolvedValue({
			id: "chat_1",
			projectId: "project_1",
			userId: "user_1",
		});
		activity.reserveActive.mockResolvedValue(true);
		chatsRepository.insertUserMessage.mockResolvedValue({ id: "message_1" });
		queue.enqueueGenerateCopy.mockImplementation(async (input) => ({
			jobId: input.jobId,
		}));

		const response = await service.sendMessage("user_1", "chat_1", {
			composer,
			text: "Write copy",
		});

		expect(response).toEqual({
			jobId: expect.any(String),
			messageId: "message_1",
		});
		expect(policy.assertCanGenerate).toHaveBeenCalledWith(
			"user_1",
			"chatMessage",
		);
		expect(activity.reserveActive).toHaveBeenCalledWith(
			"chat_1",
			response.jobId,
		);
		expect(chatsRepository.insertUserMessage).toHaveBeenCalledWith({
			chatId: "chat_1",
			composer,
			text: "Write copy",
		});
		expect(queue.enqueueGenerateCopy).toHaveBeenCalledWith({
			action: "chatMessage",
			chatId: "chat_1",
			composer,
			jobId: response.jobId,
			messageId: "message_1",
			projectId: "project_1",
			prompt: "Write copy",
			userId: "user_1",
		});
		expect(activity.releaseActive).not.toHaveBeenCalled();
	});

	it("deletes the inserted message and releases the lock when enqueue fails", async () => {
		const { activity, chatsRepository, queue, service } = setup();
		chatsRepository.findOwnedChatById.mockResolvedValue({
			id: "chat_1",
			projectId: "project_1",
			userId: "user_1",
		});
		activity.reserveActive.mockResolvedValue(true);
		chatsRepository.insertUserMessage.mockResolvedValue({ id: "message_1" });
		queue.enqueueGenerateCopy.mockRejectedValue(new Error("redis down"));

		await expect(
			service.sendMessage("user_1", "chat_1", { text: "Hello" }),
		).rejects.toBeInstanceOf(ServiceUnavailableException);

		const jobId = activity.reserveActive.mock.calls[0]?.[1];
		expect(chatsRepository.deleteMessageById).toHaveBeenCalledWith("message_1");
		expect(activity.releaseActive).toHaveBeenCalledWith("chat_1", jobId);
	});
});
