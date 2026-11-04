import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateAppProjectRequest,
	createAppProjectRequestSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import type { AppProjectsService } from "../../../application/services/app-projects.service";
import { MobileTemplateUnavailableError } from "../../../domain/errors/mobile-template-unavailable.error";
import { RedisRateLimitGuard } from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { AppProjectsController } from "./app-projects.controller";

function setup() {
	const appProjects = {
		chatCost: vi.fn<AppProjectsService["chatCost"]>(),
		create: vi.fn(async () => ({
			chatId: "chat-1",
			projectId: "project-1",
			turnId: "turn-1",
		})),
		get: vi.fn(),
	};
	const controller = new AppProjectsController(appProjects);

	return { appProjects, controller };
}

// SAFETY: the controller reads only `user.id` for the scope derivation.
const user = { id: "user_1" } as AuthUser;

const workspace: WorkspaceContext = { kind: "personal" };
// The scope that `projectScopeFrom` builds for the caller's own personal workspace.
const PERSONAL_SCOPE = {
	actorIsLimitExempt: true,
	actorRoles: ["owner"],
	actorUserId: "user_1",
	kind: "personal",
	ownerUserId: "user_1",
};

const BODY: CreateAppProjectRequest = {
	languages: ["en"],
	prompt: "Build me a booking app",
	targetPlatform: "web",
};

function requestWithHeaders(headers: Record<string, string>): FastifyRequest {
	// SAFETY: the controller reads only `headers` from the request.
	return { headers } as FastifyRequest;
}

describe("AppProjectsController", () => {
	it("create delegates with scope, body, and the edge country code", async () => {
		const { appProjects, controller } = setup();

		const result = await controller.create(
			BODY,
			user,
			workspace,
			requestWithHeaders({ "x-vercel-ip-country": "ma" }),
		);

		expect(appProjects.create).toHaveBeenCalledWith(PERSONAL_SCOPE, BODY, {
			countryCode: "MA",
		});
		expect(result).toEqual({
			chatId: "chat-1",
			projectId: "project-1",
			turnId: "turn-1",
		});
	});

	it("create passes countryCode null when no edge header is present", async () => {
		const { appProjects, controller } = setup();

		await controller.create(BODY, user, workspace, requestWithHeaders({}));

		expect(appProjects.create).toHaveBeenCalledWith(PERSONAL_SCOPE, BODY, {
			countryCode: null,
		});
	});

	it("propagates the 503 the service throws without the mobile template", async () => {
		const { appProjects, controller } = setup();
		appProjects.create.mockRejectedValue(new MobileTemplateUnavailableError());

		await expect(
			controller.create(
				{ ...BODY, targetPlatform: "mobile" },
				user,
				workspace,
				requestWithHeaders({}),
			),
		).rejects.toBeInstanceOf(MobileTemplateUnavailableError);
	});
});

describe("AppProjectsController route metadata", () => {
	it("gates create on project:create", () => {
		expect(
			Reflect.getMetadata(
				WORKSPACE_PERMISSION_KEY,
				AppProjectsController.prototype.create,
			),
		).toEqual({ actions: ["create"], resource: "project" });
	});

	it("applies V2BuilderEnabledGuard and RedisRateLimitGuard to the controller", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, AppProjectsController)).toEqual(
			[V2BuilderEnabledGuard, RedisRateLimitGuard],
		);
	});

	it("rejects an empty languages list in the body pipe", () => {
		expect(() =>
			new ZodValidationPipe(createAppProjectRequestSchema).transform(
				{ ...BODY, languages: [] },
				{ type: "body" },
			),
		).toThrow();
	});
});
