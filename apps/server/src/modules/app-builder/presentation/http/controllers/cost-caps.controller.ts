/**
 * `/api/v2/projects/:projectId/cost-caps`: read and write the monthly and
 * per-turn credit caps of one V2 app project (WANDIT-174, D7). Both
 * routes sit behind the global AuthGuard, the global ProjectAccessGuard,
 * and the `V2BuilderEnabledGuard`. The controller derives the scope with
 * `projectScopeFromAccess`. `AppProjectsService` runs the engine check.
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
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { WorkspacePermissionDeniedError } from "../../../../workspaces/domain/errors/workspace.errors";
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

	// Only a project admin or the owner can read money limits (D7).
	@RequireProjectRole("admin")
	@Get()
	async get(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ProjectCostCaps> {
		assertCanManageCostCaps(access);
		return this.appProjects.getCostCaps(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// Only a project admin or the owner can change money limits (D7).
	@RequireProjectRole("admin")
	@Put()
	async update(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(updateProjectCostCapsRequestSchema))
		body: UpdateProjectCostCapsRequest,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ProjectCostCaps> {
		assertCanManageCostCaps(access);
		return this.appProjects.updateCostCaps(
			projectScopeFromAccess(access, user.id),
			projectId,
			body,
		);
	}
}

// Product rule (design 2.2): the personal pool is the owner's money, so on a
// personal project only the owner manages caps. A team project allows admins.
function assertCanManageCostCaps(access: ResolvedProjectAccess): void {
	if (access.project.organizationId === null && access.role !== "owner") {
		throw new WorkspacePermissionDeniedError();
	}
}
