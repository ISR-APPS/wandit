/**
 * HTTP routes for V2 app projects: create and get.
 * `V2BuilderEnabledGuard` gates the whole controller, and
 * `RedisRateLimitGuard` reads the `@RateLimit` on create. Platform,
 * attachment, credits, and engine checks live in `AppProjectsService`; this
 * file parses and delegates.
 */
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AppProject,
	type CreateAppProjectRequest,
	type CreateAppProjectResponse,
	createAppProjectRequestSchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readRequestCountryCode } from "../../../../../infrastructure/http/request-country-code";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { AppProjectsService } from "../../../application/services/app-projects.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

// 10 creates per user per day (WANDIT-181). Each create can provision a
// backend and starts a first turn, so the cap stops a script that farms them.
const PROJECT_CREATE_LIMIT = 10;
// Three times the user cap: three people behind one office IP still fit,
// but the cap stops one person who uses many accounts.
const PROJECT_CREATE_IP_LIMIT = 30;
const PROJECT_CREATE_WINDOW_MS = 24 * 60 * 60_000;

@Controller("v2/projects")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class AppProjectsController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(AppProjectsService)
		private readonly appProjects: Pick<AppProjectsService, "create" | "get">,
	) {}

	@RequireWorkspacePermission("project", "create")
	@RateLimit({
		ipLimit: PROJECT_CREATE_IP_LIMIT,
		key: "project-create",
		limit: PROJECT_CREATE_LIMIT,
		windowMs: PROJECT_CREATE_WINDOW_MS,
	})
	@Post()
	create(
		@Body(new ZodValidationPipe(createAppProjectRequestSchema))
		body: CreateAppProjectRequest,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<CreateAppProjectResponse> {
		return this.appProjects.create(projectScopeFrom(workspace, user.id), body, {
			// Edge geo header, best-effort context only (not a security input).
			countryCode: readRequestCountryCode(request.headers),
		});
	}

	@Get(":projectId")
	get(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<AppProject> {
		return this.appProjects.get(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}
}
