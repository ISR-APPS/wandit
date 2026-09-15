import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { CreateAppProjectRequest } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	ProjectQueryRow,
	ProjectsRepository,
} from "../../../projects/infrastructure/persistence/projects.repository";
import { AppProjectsService } from "./app-projects.service";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const BODY: CreateAppProjectRequest = {
	languages: ["fr", "en"],
	prompt: "Build me a booking app",
	targetPlatform: "web",
};

function projectRow(overrides: Partial<ProjectQueryRow> = {}): ProjectQueryRow {
	return {
		activeSlug: null,
		createdAt: new Date("2026-08-01T08:00:00.000Z"),
		engine: "v2_app",
		framework: "web-app",
		hideWanditBadge: false,
		id: "project-1",
		languages: ["fr", "en"],
		leadCount: 0,
		logoUrl: null,
		metaPixelId: null,
		name: "Booking app",
		pendingDeploymentCount: 0,
		previewImageUrl: null,
		prompt: "Build me a booking app",
		targetPlatform: "web",
		templateVersion: "web-app@1.0.0",
		tiktokPixelId: null,
		updatedAt: new Date("2026-08-01T09:00:00.000Z"),
		...overrides,
	};
}

function setup() {
	const projects = {
		createWithChatAndFirstMessage: vi.fn<
			ProjectsRepository["createWithChatAndFirstMessage"]
		>(async (input) => ({
			chatId: input.chatId,
			messageId: input.messageId,
			projectId: input.projectId,
		})),
		findByIdForScope: vi.fn<
			(
				scope: ProjectScope,
				projectId: string,
			) => Promise<ProjectQueryRow | null>
		>(async () => projectRow()),
	};
	const projectsService = {
		startBackgroundTitle: vi.fn(async () => undefined),
	};
	const turns = {
		create: vi.fn(async () => ({
			chatId: "chat-1",
			runId: "run-1",
			status: "queued" as const,
			streamUrl: "https://api.example.com/v2/turns/turn-1/stream",
			turnId: "turn-1",
		})),
	};
	const credits = {
		getSettledBalance: vi.fn(async () => ({
			balance: 5_000,
			plan: 0,
			promo: 0,
			settledBalance: 5_000,
			settledPlan: 0,
			settledPromo: 0,
			settledTopup: 0,
			topup: 0,
		})),
	};
	const templateVersion = { current: "web-app@1.0.0" };
	const analytics = { capture: vi.fn() };
	const v2Env = {
		V2_DEFAULT_MODEL: "model-1",
		V2_HARNESS: "claude-code" as const,
	};

	const service = new AppProjectsService(
		projects,
		projectsService,
		turns,
		credits,
		templateVersion,
		analytics,
		v2Env,
	);

	return {
		analytics,
		credits,
		projects,
		projectsService,
		service,
		templateVersion,
		turns,
	};
}

describe("AppProjectsService.create", () => {
	it("rejects a mobile target with 400 before any other work", async () => {
		const { credits, projects, service, turns } = setup();

		const failure = await service
			.create(
				SCOPE,
				{ ...BODY, targetPlatform: "mobile" },
				{ countryCode: null },
			)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(BadRequestException);
		// SAFETY: toBeInstanceOf proves the type; getResponse carries the body.
		expect((failure as BadRequestException).getResponse()).toMatchObject({
			code: "V2_TARGET_PLATFORM_UNSUPPORTED",
		});
		expect(credits.getSettledBalance).not.toHaveBeenCalled();
		expect(projects.createWithChatAndFirstMessage).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("rejects a foreign attachment URL with INVALID_FILE_PART", async () => {
		const { projects, service } = setup();

		const failure = await service
			.create(
				SCOPE,
				{
					...BODY,
					attachments: [
						{
							mediaType: "image/png",
							url: "https://evil.example.com/uploads/user-1/u/f.png",
						},
					],
				},
				{ countryCode: null },
			)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(BadRequestException);
		// SAFETY: toBeInstanceOf proves the type; getResponse carries the body.
		expect((failure as BadRequestException).getResponse()).toMatchObject({
			code: "INVALID_FILE_PART",
		});
		expect(projects.createWithChatAndFirstMessage).not.toHaveBeenCalled();
	});

	it("answers 402 on a zero settled balance and writes nothing", async () => {
		const { credits, projects, service, turns } = setup();
		credits.getSettledBalance.mockResolvedValue({
			balance: 0,
			plan: 0,
			promo: 0,
			settledBalance: 0,
			settledPlan: 0,
			settledPromo: 0,
			settledTopup: 0,
			topup: 0,
		});

		const failure = await service
			.create(SCOPE, BODY, { countryCode: "MA" })
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(InsufficientCreditsError);
		expect(projects.createWithChatAndFirstMessage).not.toHaveBeenCalled();
		expect(turns.create).not.toHaveBeenCalled();
	});

	it("writes the v2_app block and starts the first turn on the written message", async () => {
		const { analytics, projects, projectsService, service, turns } = setup();

		const result = await service.create(SCOPE, BODY, { countryCode: "MA" });

		const input = projects.createWithChatAndFirstMessage.mock.calls[0]?.[0];
		if (!input) {
			throw new Error("createWithChatAndFirstMessage was not called");
		}
		expect(input).toMatchObject({
			app: {
				framework: "web-app",
				harness: "claude_code",
				languages: ["fr", "en"],
				model: "model-1",
				targetPlatform: "web",
				templateVersion: "web-app@1.0.0",
			},
			name: "Build me a booking app",
			scope: SCOPE,
		});
		expect(turns.create).toHaveBeenCalledWith(
			SCOPE,
			input.projectId,
			{
				attachments: undefined,
				chatId: input.chatId,
				composer: undefined,
				message: BODY.prompt,
			},
			{ existingMessageId: input.messageId },
		);
		expect(result).toEqual({
			chatId: input.chatId,
			projectId: input.projectId,
			turnId: "turn-1",
		});
		expect(projectsService.startBackgroundTitle).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: input.projectId,
				scope: SCOPE,
			}),
		);
		expect(analytics.capture).toHaveBeenCalledWith(
			"user-1",
			"v2_project_created",
			{
				countryCode: "MA",
				framework: "web-app",
				languages: ["fr", "en"],
				organizationId: null,
				projectId: input.projectId,
				targetPlatform: "web",
				templateVersion: "web-app@1.0.0",
				turnStarted: true,
			},
		);
	});

	it("still answers with turnId null when the first turn throws", async () => {
		const { service, turns } = setup();
		turns.create.mockRejectedValue(new Error("hold failed"));

		const result = await service.create(SCOPE, BODY, { countryCode: null });

		expect(result.turnId).toBeNull();
		expect(result.projectId).toMatch(/^[0-9a-f-]{36}$/u);
	});

	it("captures the org id on v2_project_created when scope is org", async () => {
		const { analytics, service } = setup();

		await service.create(
			{
				actorIsLimitExempt: false,
				kind: "org",
				organizationId: "org-1",
				userId: "user-1",
			},
			BODY,
			{ countryCode: null },
		);

		expect(analytics.capture).toHaveBeenCalledWith(
			"user-1",
			"v2_project_created",
			expect.objectContaining({ organizationId: "org-1" }),
		);
	});
});

describe("AppProjectsService.get", () => {
	it("maps a v2_app row to the contract", async () => {
		const { service } = setup();

		const project = await service.get(SCOPE, "project-1");

		expect(project).toMatchObject({
			engine: "v2_app",
			framework: "web-app",
			languages: ["fr", "en"],
			targetPlatform: "web",
			templateVersion: "web-app@1.0.0",
		});
	});

	it("404s on a v1_page row", async () => {
		const { projects, service } = setup();
		projects.findByIdForScope.mockResolvedValue(
			projectRow({ engine: "v1_page", targetPlatform: null }),
		);

		await expect(service.get(SCOPE, "project-1")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it("404s on a missing row", async () => {
		const { projects, service } = setup();
		projects.findByIdForScope.mockResolvedValue(null);

		await expect(service.get(SCOPE, "project-1")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});
