/**
 * `/api/v2/projects/:projectId/cost-caps`: read and write the monthly and
 * per-turn credit caps of one V2 app project (WANDIT-174, D7). Both
 * routes sit behind the global AuthGuard and the `V2BuilderEnabledGuard`.
 * The controller derives the scope with `projectScopeFrom`.
 * `AppProjectsService` runs the engine check.
 */
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Put,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type ProjectCostCaps,
	type UpdateProjectCostCapsRequest,
	updateProjectCostCapsRequestSchema,
	uuidSchema,
} from "@wandit/contracts";

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

@Controller("v2/projects/:projectId/cost-caps")
@UseGuards(V2BuilderEnabledGuard)
export class CostCapsController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(AppProjectsService)
		private readonly appProjects: Pick<
			AppProjectsService,
			"getCostCaps" | "updateCostCaps"
		>,
	) {}

	// Only an owner or an org admin can read money limits (D7).
	@RequireWorkspacePermission("limits", "manage")
	@Get()
	get(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ProjectCostCaps> {
		return this.appProjects.getCostCaps(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	// Only an owner or an org admin can change money limits (D7).
	@RequireWorkspacePermission("limits", "manage")
	@Put()
	update(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(updateProjectCostCapsRequestSchema))
		body: UpdateProjectCostCapsRequest,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ProjectCostCaps> {
		return this.appProjects.updateCostCaps(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
		);
	}
}
