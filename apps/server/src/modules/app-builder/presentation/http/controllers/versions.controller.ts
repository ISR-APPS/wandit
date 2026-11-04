/**
 * `/api/v2/projects/:projectId/versions`: the version list, one version's
 * diff, and the copy-forward restore (WANDIT-171). All three sit behind
 * the global AuthGuard and the `V2BuilderEnabledGuard`; the global
 * ProjectAccessGuard checks the project role, and the service checks the scope.
 */
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	commitShaSchema,
	type ListVersionsQuery,
	type ListVersionsResponse,
	listVersionsQuerySchema,
	type RestoreVersionBody,
	type RestoreVersionResponse,
	restoreVersionBodySchema,
	uuidSchema,
	type VersionDiffResponse,
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
import { VersionsService } from "../../../application/services/versions.service";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/** The three version routes of the V2 app builder. */
@Controller("v2/projects/:projectId/versions")
@UseGuards(V2BuilderEnabledGuard)
export class VersionsController {
	constructor(
		@Inject(VersionsService)
		private readonly versionsService: VersionsService,
	) {}

	// Newest-first page for the versions panel; `cursor`/`limit` validated.
	@RequireProjectRole("viewer")
	@Get()
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query(new ZodValidationPipe(listVersionsQuerySchema))
		query: ListVersionsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ListVersionsResponse> {
		return this.versionsService.list(
			projectScopeFromAccess(access, user.id),
			projectId,
			query,
		);
	}

	@RequireProjectRole("viewer")
	@Get(":sha/diff")
	diff(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("sha", new ZodValidationPipe(commitShaSchema)) sha: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<VersionDiffResponse> {
		return this.versionsService.diff(
			projectScopeFromAccess(access, user.id),
			projectId,
			sha,
		);
	}

	// A restore writes a commit, so it needs the same role as a turn.
	@RequireProjectRole("editor")
	@Post(":sha/restore")
	restore(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("sha", new ZodValidationPipe(commitShaSchema)) sha: string,
		@Body(new ZodValidationPipe(restoreVersionBodySchema))
		body: RestoreVersionBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<RestoreVersionResponse> {
		return this.versionsService.restore(
			projectScopeFromAccess(access, user.id),
			projectId,
			sha,
			body,
			readClientIp(request),
		);
	}
}
