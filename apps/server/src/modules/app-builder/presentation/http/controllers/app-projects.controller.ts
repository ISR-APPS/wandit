/**
 * HTTP routes for V2 app projects: create and get.
 * `V2BuilderEnabledGuard` gates the whole controller. Platform, attachment,
 * credits, and engine checks live in `AppProjectsService`; this file parses
 * and delegates.
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
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

@Controller("v2/projects")
@UseGuards(V2BuilderEnabledGuard)
export class AppProjectsController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(AppProjectsService)
		private readonly appProjects: Pick<AppProjectsService, "create" | "get">,
	) {}

	// WANDIT-181 adds a per-user create rate limit here.
	@RequireWorkspacePermission("project", "create")
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
