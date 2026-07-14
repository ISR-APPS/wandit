import { describe, expect, it, vi } from "vitest";

import type { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
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
	const service = new ProjectsService(
		projectsRepository as unknown as ProjectsRepository,
		policy as unknown as GenerationPolicyService,
	);

	return { policy, projectsRepository, service };
}

describe("ProjectsService", () => {
	it("creates a project, chat, and first user message", async () => {
		const { policy, projectsRepository, service } = setup();
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
	});

	it("derives a short project name on word boundaries", () => {
		expect(
			deriveProjectName(
				"Build a landing page for a premium kitchenware launch with COD",
			),
		).toBe("Build a landing page for a premium");
	});
});
