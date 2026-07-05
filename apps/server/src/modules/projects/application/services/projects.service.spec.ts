import { describe, expect, it, vi } from "vitest";

import type { GenerationActivityService } from "../../../generation/application/services/generation-activity.service";
import type { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import type { GenerationQueueService } from "../../../generation/application/services/generation-queue.service";
import type { ProjectsRepository } from "../../infrastructure/persistence/projects.repository";
import { deriveProjectName, ProjectsService } from "./projects.service";

function setup() {
	const projectsRepository = {
		createWithChatAndFirstMessage: vi.fn(),
		findByIdForUser: vi.fn(),
		listByUser: vi.fn(),
		softDeleteByIdForUser: vi.fn(),
		updateByIdForUser: vi.fn(),
	};
	const policy = {
		assertCanGenerate: vi.fn(),
	};
	const queue = {
		enqueueGenerateCopy: vi.fn(),
	};
	const activity = {
		releaseActive: vi.fn(),
		reserveActive: vi.fn(),
	};
	const service = new ProjectsService(
		projectsRepository as unknown as ProjectsRepository,
		policy as unknown as GenerationPolicyService,
		queue as unknown as GenerationQueueService,
		activity as unknown as GenerationActivityService,
	);

	return { activity, policy, projectsRepository, queue, service };
}

describe("ProjectsService", () => {
	it("creates a project, chat, first message, and generation job", async () => {
		const { activity, policy, projectsRepository, queue, service } = setup();
		const composer = {
			mode: "page" as const,
			output: "landing page",
			quality: "standard" as const,
		};
		projectsRepository.createWithChatAndFirstMessage.mockResolvedValue({
			chatId: "chat_1",
			messageId: "message_1",
			projectId: "project_1",
		});
		activity.reserveActive.mockResolvedValue(true);
		queue.enqueueGenerateCopy.mockImplementation(async (input) => ({
			jobId: input.jobId,
		}));

		await expect(
			service.create("user_1", {
				composer,
				prompt:
					"Create a fast landing page for a launch campaign with proof and pricing",
			}),
		).resolves.toEqual({ chatId: "chat_1", projectId: "project_1" });
		expect(policy.assertCanGenerate).toHaveBeenCalledWith(
			"user_1",
			"landingPageGeneration",
		);
		expect(
			projectsRepository.createWithChatAndFirstMessage,
		).toHaveBeenCalledWith({
			composer,
			name: "Create a fast landing page for a launch",
			prompt:
				"Create a fast landing page for a launch campaign with proof and pricing",
			userId: "user_1",
		});
		const jobId = activity.reserveActive.mock.calls[0]?.[1];
		expect(activity.reserveActive).toHaveBeenCalledWith("chat_1", jobId);
		expect(queue.enqueueGenerateCopy).toHaveBeenCalledWith({
			action: "landingPageGeneration",
			chatId: "chat_1",
			composer,
			jobId,
			messageId: "message_1",
			projectId: "project_1",
			prompt:
				"Create a fast landing page for a launch campaign with proof and pricing",
			userId: "user_1",
		});
		expect(activity.releaseActive).not.toHaveBeenCalled();
	});

	it("keeps the created workspace and releases the lock when enqueue fails", async () => {
		const { activity, projectsRepository, queue, service } = setup();
		projectsRepository.createWithChatAndFirstMessage.mockResolvedValue({
			chatId: "chat_1",
			messageId: "message_1",
			projectId: "project_1",
		});
		activity.reserveActive.mockResolvedValue(true);
		queue.enqueueGenerateCopy.mockRejectedValue(new Error("redis down"));

		await expect(
			service.create("user_1", { prompt: "Create a project" }),
		).rejects.toMatchObject({
			response: expect.objectContaining({
				code: "GENERATION_QUEUE_UNAVAILABLE",
			}),
		});

		const jobId = activity.reserveActive.mock.calls[0]?.[1];
		expect(activity.releaseActive).toHaveBeenCalledWith("chat_1", jobId);
		expect(projectsRepository.createWithChatAndFirstMessage).toHaveBeenCalled();
	});

	it("derives a short project name on word boundaries", () => {
		expect(
			deriveProjectName(
				"Build a landing page for a premium kitchenware launch with COD",
			),
		).toBe("Build a landing page for a premium");
	});
});
