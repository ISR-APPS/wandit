/**
 * Tests for ChatService.
 *
 * ChatService is the send-message flow:
 * check owner -> check credits -> reserve Redis -> save user message -> queue job.
 */
import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { GenerationActiveError } from "../../domain/errors/generation-active.error";
import type { ChatsRepository } from "../../infrastructure/persistence/chats.repository";
import { ChatService } from "./chat.service";
import type { GenerationActivityService } from "./generation-activity.service";
import type { GenerationPolicyService } from "./generation-policy.service";
import type { GenerationQueueService } from "./generation-queue.service";

// In real Nest code, dependencies are injected. In tests we pass fake objects.
function setup() {
	// Fake database helper.
	const chatsRepository = {
		deleteMessageById: vi.fn(),
		findOwnedChatById: vi.fn(),
		insertUserMessage: vi.fn(),
		listMessages: vi.fn(),
	};
	// Fake Redis busy-flag helper.
	const activity = {
		getActiveJobId: vi.fn(),
		releaseActive: vi.fn(),
		reserveActive: vi.fn(),
	};
	// Fake credits/subscription gate.
	const policy = {
		assertCanGenerate: vi.fn(),
	};
	// Fake queue helper.
	const queue = {
		enqueueGenerateCopy: vi.fn(),
	};
	// Casts keep the fake objects small.
	const service = new ChatService(
		chatsRepository as unknown as ChatsRepository,
		activity as unknown as GenerationActivityService,
		policy as unknown as GenerationPolicyService,
		queue as unknown as GenerationQueueService,
	);

	return { activity, chatsRepository, policy, queue, service };
}

// Test the send-message orchestration.
describe("ChatService", () => {
	// User cannot send to a chat they do not own.
	it("returns 404 when the chat is not owned by the caller", async () => {
		const { chatsRepository, service } = setup();
		// No owned chat found.
		chatsRepository.findOwnedChatById.mockResolvedValue(null);

		await expect(
			service.sendMessage("user_1", "chat_1", { text: "Hello" }),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	// If Redis says busy, do not save or enqueue anything.
	it("rejects when active generation reservation is not acquired", async () => {
		const { activity, chatsRepository, policy, queue, service } = setup();
		chatsRepository.findOwnedChatById.mockResolvedValue({
			id: "chat_1",
			projectId: "project_1",
			userId: "user_1",
		});
		// false means another job already owns the busy flag.
		activity.reserveActive.mockResolvedValue(false);

		await expect(
			service.sendMessage("user_1", "chat_1", { text: "Hello" }),
		).rejects.toBeInstanceOf(GenerationActiveError);
		// Billing check happens before Redis reservation.
		expect(policy.assertCanGenerate).toHaveBeenCalledWith(
			"user_1",
			"chatMessage",
		);
		// No message or job should be created.
		expect(chatsRepository.insertUserMessage).not.toHaveBeenCalled();
		expect(queue.enqueueGenerateCopy).not.toHaveBeenCalled();
	});

	// Happy path: save user message, then enqueue worker job.
	it("persists the user message and enqueues generation", async () => {
		const { activity, chatsRepository, policy, queue, service } = setup();
		// Composer metadata comes from the prompt box settings.
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
		// Fake queue returns the same job id.
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
		// Chat messages use the chat generation credit action.
		expect(policy.assertCanGenerate).toHaveBeenCalledWith(
			"user_1",
			"chatMessage",
		);
		// Redis busy flag and queue use the same job id.
		expect(activity.reserveActive).toHaveBeenCalledWith(
			"chat_1",
			response.jobId,
		);
		// User message is saved before worker starts.
		expect(chatsRepository.insertUserMessage).toHaveBeenCalledWith({
			chatId: "chat_1",
			composer,
			text: "Write copy",
		});
		// Worker needs ids, prompt, and composer settings.
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
		// Worker clears the busy flag after generation finishes.
		expect(activity.releaseActive).not.toHaveBeenCalled();
	});

	// If queueing fails after save, clean up the saved message and Redis flag.
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

		// Read the random job id from the earlier mock call.
		const jobId = activity.reserveActive.mock.calls[0]?.[1];
		// No orphan message, no stale busy flag.
		expect(chatsRepository.deleteMessageById).toHaveBeenCalledWith("message_1");
		expect(activity.releaseActive).toHaveBeenCalledWith("chat_1", jobId);
	});
});
