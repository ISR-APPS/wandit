/**
 * Serves V1 project routes and denies new project creation.
 * Nest calls this controller after the session and workspace guards.
 * Existing project routes call ProjectsService.
 */
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	Inject,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateProjectBody,
	type CreateProjectResponse,
	createProjectBodySchema,
	type ListProjectsPageResponse,
	type ListProjectsQuery,
	type ListProjectsResponse,
	listProjectsQuerySchema,
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
/** Keeps existing projects available while V1 creation is closed. */
@Controller("v1/projects")
export class ProjectsController {
	constructor(
		@Inject(ProjectsService)
		private readonly projectsService: Pick<
			ProjectsService,
			"delete" | "get" | "list" | "listPaged" | "update"
		>,
	) {}

	@Get()
	list(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListProjectsResponse> {
		return this.projectsService.list(projectScopeFrom(workspace, user.id));
	}

	@Get("paged")
	listPaged(
		@Query(new ZodValidationPipe(listProjectsQuerySchema))
		query: ListProjectsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListProjectsPageResponse> {
		return this.projectsService.listPaged(
			projectScopeFrom(workspace, user.id),
			query,
		);
	}

	/** Denies creation before credit reservations or project writes. */
	@RequireWorkspacePermission("project", "create")
	@Post()
	create(
		@Body(new ZodValidationPipe(createProjectBodySchema))
		_body: CreateProjectBody,
		@CurrentUser() _user: AuthUser,
		@CurrentWorkspace() _workspace: WorkspaceContext,
	): Promise<CreateProjectResponse> {
		// The launch restriction must also cover direct API requests.
		throw new ForbiddenException({
			code: "V1_PROJECT_CREATION_DISABLED",
			message: "New V1 projects are disabled.",
		});
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
