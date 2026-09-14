/**
 * `/api/v2/projects/:projectId/versions`: the version list, one version's
 * diff, and the copy-forward restore (WANDIT-171). All three sit behind
 * the global AuthGuard and the `V2BuilderEnabledGuard`; scope checks run
 * in the service through `projectScopeFrom`.
 */
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Query,
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

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
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
	@Get()
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query(new ZodValidationPipe(listVersionsQuerySchema))
		query: ListVersionsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListVersionsResponse> {
		return this.versionsService.list(
			projectScopeFrom(workspace, user.id),
			projectId,
			query,
		);
	}

	@Get(":sha/diff")
	diff(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("sha", new ZodValidationPipe(commitShaSchema)) sha: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<VersionDiffResponse> {
		return this.versionsService.diff(
			projectScopeFrom(workspace, user.id),
			projectId,
			sha,
		);
	}

	// A restore writes a commit, so it needs the same permission as a turn.
	@RequireWorkspacePermission("project", "update")
	@Post(":sha/restore")
	restore(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("sha", new ZodValidationPipe(commitShaSchema)) sha: string,
		@Body(new ZodValidationPipe(restoreVersionBodySchema))
		body: RestoreVersionBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<RestoreVersionResponse> {
		return this.versionsService.restore(
			projectScopeFrom(workspace, user.id),
			projectId,
			sha,
			body,
		);
	}
}
