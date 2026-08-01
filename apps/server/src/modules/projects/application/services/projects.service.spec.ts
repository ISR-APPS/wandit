import { BadRequestException, Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isUserUploadUrl } from "../../../../infrastructure/storage/r2";
import type { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import type { ProjectsRepository } from "../../infrastructure/persistence/projects.repository";
import type { ProjectTitleService } from "./project-title.service";
import { deriveProjectName, ProjectsService } from "./projects.service";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	isUserUploadUrl: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

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
	const projectTitleService = {
		generate: vi.fn((input: { fallbackTitle: string }) =>
			Promise.resolve(input.fallbackTitle),
		),
	};
	const service = new ProjectsService(
		projectsRepository as unknown as ProjectsRepository,
		policy as unknown as GenerationPolicyService,
		projectTitleService as unknown as ProjectTitleService,
	);

	return { policy, projectsRepository, projectTitleService, service };
}

describe("ProjectsService", () => {
	it("creates a project, chat, and first user message", async () => {
		const { policy, projectsRepository, projectTitleService, service } =
			setup();
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
		expect(projectTitleService.generate).toHaveBeenCalledWith({
			attachments: undefined,
			fallbackTitle: "Create a fast landing page for a launch",
			prompt:
				"Create a fast landing page for a launch campaign with proof and pricing",
		});
	});

	it("persists a generated title only while the derived name is unchanged", async () => {
		const { projectsRepository, projectTitleService, service } = setup();
		projectsRepository.createWithChatAndFirstMessage.mockResolvedValue({
			chatId: "chat_1",
			messageId: "message_1",
			projectId: "project_1",
		});
		projectTitleService.generate.mockResolvedValue("Maison Lila Summer Launch");

		await service.create("user_1", {
			prompt:
				"Create a fast landing page for a launch campaign with proof and pricing",
		});

		await vi.waitFor(() => {
			expect(projectsRepository.updateByIdForUser).toHaveBeenCalledWith(
				"user_1",
				"project_1",
				{ name: "Maison Lila Summer Launch" },
				{ expectedName: "Create a fast landing page for a launch" },
			);
		});
	});

	it("still succeeds when background title generation throws", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { projectsRepository, projectTitleService, service } = setup();
		projectsRepository.createWithChatAndFirstMessage.mockResolvedValue({
			chatId: "chat_1",
			messageId: "message_1",
			projectId: "project_1",
		});
		projectTitleService.generate.mockRejectedValue(new Error("title failure"));

		await expect(
			service.create("user_1", { prompt: "Build Maison Lila's website" }),
		).resolves.toEqual({ chatId: "chat_1", projectId: "project_1" });
		await vi.waitFor(() => {
			expect(warn).toHaveBeenCalledWith(
				"Background project title update failed: title failure",
			);
		});
		expect(projectsRepository.updateByIdForUser).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it("derives a short project name on word boundaries", () => {
		expect(
			deriveProjectName(
				"Build a landing page for a premium kitchenware launch with COD",
			),
		).toBe("Build a landing page for a premium");
	});

	it("accepts an owned user-uploaded image as the project logo", async () => {
		const { projectsRepository, service } = setup();
		const logoUrl =
			"https://assets.example.com/uploads/user_1/upload_1/brand.WEBP?download=1";
		vi.mocked(isUserUploadUrl).mockReturnValue(true);
		projectsRepository.updateByIdForUser.mockResolvedValue(
			projectRow({ logoUrl }),
		);

		await expect(
			service.update("user_1", "project_1", { logoUrl }),
		).resolves.toMatchObject({ logoUrl });
		expect(isUserUploadUrl).toHaveBeenCalledWith(logoUrl, "user_1");
		expect(projectsRepository.updateByIdForUser).toHaveBeenCalledWith(
			"user_1",
			"project_1",
			{ logoUrl },
		);
	});

	it.each([
		[
			"another user's upload",
			"https://assets.example.com/uploads/user_2/upload_1/brand.png",
			false,
		],
		[
			"a non-image upload",
			"https://assets.example.com/uploads/user_1/upload_1/brand.pdf",
			true,
		],
	])("rejects %s as a project logo", async (_, logoUrl, isOwnedUpload) => {
		const { projectsRepository, service } = setup();
		vi.mocked(isUserUploadUrl).mockReturnValue(isOwnedUpload);

		const error = await service
			.update("user_1", "project_1", { logoUrl })
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as BadRequestException).getResponse()).toEqual({
			code: "INVALID_LOGO_URL",
			message:
				"Project logo must be a Wandit-uploaded JPEG, PNG, WebP, GIF, or AVIF image",
		});
		expect(projectsRepository.updateByIdForUser).not.toHaveBeenCalled();
	});

	it("allows null to remove the project logo", async () => {
		const { projectsRepository, service } = setup();
		projectsRepository.updateByIdForUser.mockResolvedValue(
			projectRow({ logoUrl: null }),
		);

		await expect(
			service.update("user_1", "project_1", { logoUrl: null }),
		).resolves.toMatchObject({ logoUrl: null });
		expect(isUserUploadUrl).not.toHaveBeenCalled();
	});
});

function projectRow(overrides: { logoUrl: string | null }) {
	return {
		activeSlug: null,
		createdAt: new Date("2026-08-01T08:00:00.000Z"),
		id: "project_1",
		leadCount: 0,
		logoUrl: overrides.logoUrl,
		metaPixelId: null,
		name: "Wandit",
		pendingDeploymentCount: 0,
		previewImageUrl: null,
		prompt: "Build a page",
		tiktokPixelId: null,
		updatedAt: new Date("2026-08-01T09:00:00.000Z"),
	};
}
