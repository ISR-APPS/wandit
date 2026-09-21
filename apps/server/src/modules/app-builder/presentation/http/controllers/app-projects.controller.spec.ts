import { BadRequestException } from "@nestjs/common";
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
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { AppProjectsController } from "./app-projects.controller";

function setup() {
	const appProjects = {
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

		expect(appProjects.create).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			BODY,
			{ countryCode: "MA" },
		);
		expect(result).toEqual({
			chatId: "chat-1",
			projectId: "project-1",
			turnId: "turn-1",
		});
	});

	it("create passes countryCode null when no edge header is present", async () => {
		const { appProjects, controller } = setup();

		await controller.create(BODY, user, workspace, requestWithHeaders({}));

		expect(appProjects.create).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			BODY,
			{ countryCode: null },
		);
	});

	it("get delegates with scope and project id", async () => {
		const { appProjects, controller } = setup();
		appProjects.get.mockResolvedValue({ id: "project-1" });

		await controller.get("project-1", user, workspace);

		expect(appProjects.get).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			"project-1",
		);
	});

	it("propagates the 400 the service throws for mobile", async () => {
		const { appProjects, controller } = setup();
		appProjects.create.mockRejectedValue(
			new BadRequestException({ code: "V2_TARGET_PLATFORM_UNSUPPORTED" }),
		);

		await expect(
			controller.create(
				{ ...BODY, targetPlatform: "mobile" },
				user,
				workspace,
				requestWithHeaders({}),
			),
		).rejects.toBeInstanceOf(BadRequestException);
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

	it("applies V2BuilderEnabledGuard to the controller", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, AppProjectsController)).toEqual(
			[V2BuilderEnabledGuard],
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
