import { BadRequestException, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isUserUploadUrl } from "../../../../infrastructure/storage/r2";
import type { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import type { ProjectScope } from "../../domain/project-scope";
import type { ProjectsRepository } from "../../infrastructure/persistence/projects.repository";
import type { ProjectTitleService } from "./project-title.service";
import { deriveProjectName, ProjectsService } from "./projects.service";

const personalScope: ProjectScope = { kind: "personal", userId: "user_1" };

vi.mock("../../../../infrastructure/storage/r2", () => ({
	isUserUploadUrl: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
	(
		env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
	).GENERATION_BILLING_MODE = "enforce";
});

function setup() {
	const projectsRepository = {
		createWithChatAndFirstMessage: vi.fn(
			(input: { chatId: string; messageId: string; projectId: string }) =>
				Promise.resolve({
					chatId: input.chatId,
					messageId: input.messageId,
					projectId: input.projectId,
				}),
		),
		findByIdForScope: vi.fn(),
		listForScope: vi.fn(),
		listPageForScope: vi.fn(),
		softDeleteByIdForScope: vi.fn(),
		updateByIdForScope: vi.fn(),
	};
	const meteringService = {
		refund: vi.fn(),
		reserve: vi.fn().mockResolvedValue({ id: "usage_event_1" }),
	};
	const modelPricingService = {
		quoteTokenUsage: vi.fn().mockResolvedValue({
			costUsdMicros: 60_000,
			credits: 200,
		}),
	};
	const projectTitleService = {
		generate: vi.fn((input: { fallbackTitle: string }) =>
			Promise.resolve(input.fallbackTitle),
		),
	};
	const lifecycleEvents = {
		enqueue: vi.fn().mockResolvedValue(null),
	};
	const service = new ProjectsService(
		projectsRepository as unknown as ProjectsRepository,
		meteringService as unknown as MeteringService,
		modelPricingService as unknown as ModelPricingService,
		projectTitleService as unknown as ProjectTitleService,
		lifecycleEvents as unknown as LifecycleEventsService,
	);

	return {
		lifecycleEvents,
		meteringService,
		modelPricingService,
		projectsRepository,
		projectTitleService,
		service,
	};
}

describe("ProjectsService", () => {
	it("maps a paginated project list", async () => {
		const { projectsRepository, service } = setup();
		const query = {
			page: 2,
			pageSize: 20,
			search: "launch",
		};
		projectsRepository.listPageForScope.mockResolvedValue({
			items: [
				{
					activeSlug: "summer-launch",
					createdAt: new Date("2026-07-01T10:00:00.000Z"),
					hideWanditBadge: false,
					id: "018fc53d-6537-7a73-9217-1d7a677c8e0a",
					leadCount: 4,
					logoUrl: null,
					metaPixelId: null,
					name: "Summer launch",
					pendingDeploymentCount: 0,
					previewImageUrl: null,
					prompt: "Build a launch page",
					tiktokPixelId: "tt-1",
					updatedAt: new Date("2026-07-02T10:00:00.000Z"),
				},
			],
			page: 2,
			pageSize: 20,
			total: 24,
		});

		await expect(
			service.listPaged(personalScope, query),
		).resolves.toMatchObject({
			items: [
				{
					createdAt: "2026-07-01T10:00:00.000Z",
					id: "018fc53d-6537-7a73-9217-1d7a677c8e0a",
					publishedSlug: "summer-launch",
					status: "published",
					updatedAt: "2026-07-02T10:00:00.000Z",
				},
			],
			page: 2,
			pageSize: 20,
			total: 24,
		});
		expect(projectsRepository.listPageForScope).toHaveBeenCalledWith(
			personalScope,
			query,
		);
	});

	it("creates a project, chat, and first user message", async () => {
		const {
			lifecycleEvents,
			meteringService,
			projectsRepository,
			projectTitleService,
			service,
		} = setup();
		const composer = {
			mode: "page" as const,
			output: "landing page",
			quality: "standard" as const,
		};
		const created = await service.create(personalScope, {
			composer,
			prompt:
				"Create a fast landing page for a launch campaign with proof and pricing",
		});
		expect(created.chatId).toMatch(/^[0-9a-f-]{36}$/u);
		expect(created.projectId).toMatch(/^[0-9a-f-]{36}$/u);
		expect(
			projectsRepository.createWithChatAndFirstMessage,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				composer,
				name: "Create a fast landing page for a launch",
				prompt:
					"Create a fast landing page for a launch campaign with proof and pricing",
				scope: personalScope,
			}),
		);
		const persistenceInput =
			projectsRepository.createWithChatAndFirstMessage.mock.calls[0]?.[0];
		expect(meteringService.reserve).toHaveBeenCalledWith(
			"chat",
			{ actorUserId: "user_1" },
			{
				attemptRef: `bundled-pending:project:${persistenceInput?.projectId}`,
				chatId: persistenceInput?.chatId,
				credits: 200,
				estimatedCostUsdMicros: 60_000,
				idempotencyKey: `project-create:${persistenceInput?.projectId}`,
				messageId: persistenceInput?.messageId,
				model: expect.any(String),
			},
		);
		expect(lifecycleEvents.enqueue).toHaveBeenCalledWith({
			event: "first_prompt_sent",
			idempotencyKey: "first_prompt_sent:user_1",
			userId: "user_1",
		});
		expect(
			projectsRepository.createWithChatAndFirstMessage.mock
				.invocationCallOrder[0],
		).toBeLessThan(lifecycleEvents.enqueue.mock.invocationCallOrder[0] ?? 0);
		expect(projectTitleService.generate).toHaveBeenCalledWith({
			attachments: undefined,
			fallbackTitle: "Create a fast landing page for a launch",
			organizationId: null,
			prompt:
				"Create a fast landing page for a launch campaign with proof and pricing",
			usageEventId: "usage_event_1",
			userId: "user_1",
		});
	});

	it("keeps a committed project successful when lifecycle enqueue fails", async () => {
		const error = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const { lifecycleEvents, service } = setup();
		lifecycleEvents.enqueue.mockRejectedValueOnce(
			new Error("lifecycle unavailable"),
		);

		await expect(
			service.create(personalScope, { prompt: "Build a storefront" }),
		).resolves.toEqual({
			chatId: expect.any(String),
			projectId: expect.any(String),
		});
		expect(error).toHaveBeenCalledWith(
			"First prompt lifecycle enqueue failed for user user_1: lifecycle unavailable",
		);
		error.mockRestore();
	});

	it("meters org-scoped creation against the org pool with the acting member", async () => {
		const { lifecycleEvents, meteringService, projectsRepository, service } =
			setup();
		const orgScope: ProjectScope = {
			actorIsLimitExempt: false,
			kind: "org",
			organizationId: "org_1",
			userId: "user_1",
		};

		await service.create(orgScope, { prompt: "Build a team storefront" });

		expect(meteringService.reserve).toHaveBeenCalledWith(
			"chat",
			{
				actorIsLimitExempt: false,
				actorUserId: "user_1",
				organizationId: "org_1",
			},
			expect.any(Object),
		);
		expect(
			projectsRepository.createWithChatAndFirstMessage,
		).toHaveBeenCalledWith(expect.objectContaining({ scope: orgScope }));
		expect(lifecycleEvents.enqueue).toHaveBeenCalledWith({
			event: "first_prompt_sent",
			idempotencyKey: "first_prompt_sent:user_1",
			userId: "user_1",
		});
	});

	it("persists a generated title only while the derived name is unchanged", async () => {
		const { projectsRepository, projectTitleService, service } = setup();
		projectTitleService.generate.mockResolvedValue("Maison Lila Summer Launch");

		await service.create(personalScope, {
			prompt:
				"Create a fast landing page for a launch campaign with proof and pricing",
		});

		await vi.waitFor(() => {
			const projectId =
				projectsRepository.createWithChatAndFirstMessage.mock.calls[0]?.[0]
					?.projectId;
			expect(projectsRepository.updateByIdForScope).toHaveBeenCalledWith(
				personalScope,
				projectId,
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
		projectTitleService.generate.mockRejectedValue(new Error("title failure"));

		await expect(
			service.create(personalScope, { prompt: "Build Maison Lila's website" }),
		).resolves.toEqual({
			chatId: expect.any(String),
			projectId: expect.any(String),
		});
		await vi.waitFor(() => {
			expect(warn).toHaveBeenCalledWith(
				"Background project title update failed: title failure",
			);
		});
		expect(projectsRepository.updateByIdForScope).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it("refunds the reservation when the project transaction fails", async () => {
		const transactionError = new Error("project transaction failed");
		const {
			meteringService,
			projectsRepository,
			projectTitleService,
			service,
		} = setup();
		projectsRepository.createWithChatAndFirstMessage.mockRejectedValueOnce(
			transactionError,
		);

		await expect(
			service.create(personalScope, { prompt: "Build a storefront" }),
		).rejects.toBe(transactionError);

		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"project_creation_failed",
		);
		expect(projectTitleService.generate).not.toHaveBeenCalled();
	});

	it("preserves the explicit local billing-off bypass", async () => {
		(
			env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
		).GENERATION_BILLING_MODE = "off";
		const { meteringService, modelPricingService, service } = setup();

		await expect(
			service.create(personalScope, { prompt: "Build a storefront" }),
		).resolves.toEqual({
			chatId: expect.any(String),
			projectId: expect.any(String),
		});

		expect(modelPricingService.quoteTokenUsage).not.toHaveBeenCalled();
		expect(meteringService.reserve).not.toHaveBeenCalled();
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
		projectsRepository.updateByIdForScope.mockResolvedValue(
			projectRow({ logoUrl }),
		);

		await expect(
			service.update(personalScope, "project_1", { logoUrl }),
		).resolves.toMatchObject({ logoUrl });
		expect(isUserUploadUrl).toHaveBeenCalledWith(logoUrl, "user_1");
		expect(projectsRepository.updateByIdForScope).toHaveBeenCalledWith(
			personalScope,
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
			.update(personalScope, "project_1", { logoUrl })
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as BadRequestException).getResponse()).toEqual({
			code: "INVALID_LOGO_URL",
			message:
				"Project logo must be a Wandit-uploaded JPEG, PNG, WebP, GIF, or AVIF image",
		});
		expect(projectsRepository.updateByIdForScope).not.toHaveBeenCalled();
	});

	it("allows null to remove the project logo", async () => {
		const { projectsRepository, service } = setup();
		projectsRepository.updateByIdForScope.mockResolvedValue(
			projectRow({ logoUrl: null }),
		);

		await expect(
			service.update(personalScope, "project_1", { logoUrl: null }),
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
