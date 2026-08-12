import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Inject,
	Param,
	Patch,
	Post,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateProjectBody,
	type CreateProjectResponse,
	createProjectBodySchema,
	type ListProjectsResponse,
	type Project,
	type UpdateProjectBody,
	updateProjectBodySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { ProjectsService } from "../../../application/services/projects.service";
import { projectScopeFrom } from "../../../domain/project-scope";

// The x-wandit-workspace header (resolved by WorkspaceContextGuard) selects
// personal vs org scope. Role gates apply only in org scope — personal
// workspaces bypass them (the owner is omnipotent in their own space).
@Controller("v1/projects")
export class ProjectsController {
	constructor(
		@Inject(ProjectsService)
		private readonly projectsService: ProjectsService,
	) {}

	@Get()
	list(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListProjectsResponse> {
		return this.projectsService.list(projectScopeFrom(workspace, user.id));
	}

	@RequireWorkspacePermission("project", "create")
	@Post()
	create(
		@Body(new ZodValidationPipe(createProjectBodySchema))
		body: CreateProjectBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CreateProjectResponse> {
		return this.projectsService.create(
			projectScopeFrom(workspace, user.id),
			body,
		);
	}

	@Get(":projectId")
	get(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<Project> {
		return this.projectsService.get(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@RequireWorkspacePermission("project", "update")
	@Patch(":projectId")
	update(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(updateProjectBodySchema))
		body: UpdateProjectBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<Project> {
		return this.projectsService.update(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
		);
	}

	// Destructive: members cannot delete org projects, only owners/admins.
	@RequireWorkspacePermission("project", "delete")
	@Delete(":projectId")
	@HttpCode(204)
	delete(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<void> {
		return this.projectsService.delete(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}
}
