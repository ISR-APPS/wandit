/**
 * `/api/v2/projects/:projectId/secrets`: the write-only secret store of
 * one V2 app project (WANDIT-185). The three routes sit behind the global
 * AuthGuard, the global ProjectAccessGuard (editor), and `V2BuilderEnabledGuard`;
 * the scope check runs in `ProjectSecretsService`. No route answers a value.
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
	userSecretNameSchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readClientIp } from "../../../../../infrastructure/http/client-ip";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
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

	// An editor or higher; never a viewer.
	@RequireProjectRole("editor")
	@Get()
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ListProjectSecretsResponse> {
		return this.secrets.listNames(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// The body holds the value once; the answer and the logs never carry it.
	// Security: a `SUPABASE_` name answers 400, so no user row takes the name
	// of a Supabase key that provisioning stores.
	@RequireProjectRole("editor")
	@Put(":name")
	@HttpCode(204)
	async set(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("name", new ZodValidationPipe(userSecretNameSchema))
		name: string,
		@Body(new ZodValidationPipe(setProjectSecretRequestSchema))
		body: SetProjectSecretRequest,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<void> {
		await this.secrets.set(projectId, name, body.value, "user", {
			ip: readClientIp(request),
			scope: projectScopeFromAccess(access, user.id),
		});
	}

	@RequireProjectRole("editor")
	@Delete(":name")
	@HttpCode(204)
	remove(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("name", new ZodValidationPipe(projectSecretNameSchema))
		name: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<void> {
		return this.secrets.remove(projectId, name, {
			ip: readClientIp(request),
			scope: projectScopeFromAccess(access, user.id),
		});
	}
}
