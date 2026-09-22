/**
 * `/api/v2/projects/:projectId/secrets`: the write-only secret store of
 * one V2 app project (WANDIT-185). The three routes sit behind the global
 * AuthGuard, the workspace guard, and `V2BuilderEnabledGuard`; the scope
 * check runs in `ProjectSecretsService`. No route answers a value.
 */
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Inject,
	Param,
	Put,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type ListProjectSecretsResponse,
	projectSecretNameSchema,
	type SetProjectSecretRequest,
	setProjectSecretRequestSchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readClientIp } from "../../../../../infrastructure/http/client-ip";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { ProjectSecretsService } from "../../../application/services/project-secrets.service";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

@Controller("v2/projects/:projectId/secrets")
@UseGuards(V2BuilderEnabledGuard)
export class ProjectSecretsController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(ProjectSecretsService)
		private readonly secrets: Pick<
			ProjectSecretsService,
			"set" | "remove" | "listNames"
		>,
	) {}

	// An owner, an admin, or a member with project:update; never a viewer.
	@RequireWorkspacePermission("project", "update")
	@Get()
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListProjectSecretsResponse> {
		return this.secrets.listNames(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	// The body holds the value once; the answer and the logs never carry it.
	@RequireWorkspacePermission("project", "update")
	@Put(":name")
	@HttpCode(204)
	set(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("name", new ZodValidationPipe(projectSecretNameSchema))
		name: string,
		@Body(new ZodValidationPipe(setProjectSecretRequestSchema))
		body: SetProjectSecretRequest,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<void> {
		return this.secrets.set(projectId, name, body.value, "user", {
			ip: readClientIp(request),
			scope: projectScopeFrom(workspace, user.id),
		});
	}

	@RequireWorkspacePermission("project", "update")
	@Delete(":name")
	@HttpCode(204)
	remove(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("name", new ZodValidationPipe(projectSecretNameSchema))
		name: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<void> {
		return this.secrets.remove(projectId, name, {
			ip: readClientIp(request),
			scope: projectScopeFrom(workspace, user.id),
		});
	}
}
