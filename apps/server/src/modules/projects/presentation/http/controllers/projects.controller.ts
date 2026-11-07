/**
 * Serves the V1 project routes: list, create, get, update, and delete.
 * Nest calls it after the session, workspace, and project access guards.
 * It calls ProjectsService, which reserves the credits of a new project.
 */
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
import { WorkspacePermissionDeniedError } from "../../../../workspaces/domain/errors/workspace.errors";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { ProjectsService } from "../../../application/services/projects.service";
import {
	canDeleteProject,
	type ResolvedProjectAccess,
} from "../../../domain/project-access";
import {
	projectScopeFrom,
	projectScopeFromAccess,
} from "../../../domain/project-scope";
import {
	CurrentProjectAccess,
	RequireProjectRole,
} from "../decorators/project-access.decorators";

// The list and create routes read the x-wandit-workspace header (resolved by
// WorkspaceContextGuard). The `:projectId` routes use the caller's role on
// the project, for every engine, and never the header role (design 3.3).
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

	@RequireProjectRole("viewer", { anyEngine: true })
	@Get(":projectId")
	get(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<Project> {
		return this.projectsService.get(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// A rename is an edit: a viewer must not write.
	@RequireProjectRole("editor", { anyEngine: true })
	@Patch(":projectId")
	update(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(updateProjectBodySchema))
		body: UpdateProjectBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<Project> {
		return this.projectsService.update(
			projectScopeFromAccess(access, user.id),
			projectId,
			body,
		);
	}

	// The guard only proves access. canDeleteProject applies the delete rule:
	// a V2 project needs its owner, a V1 project keeps `project:delete`.
	@RequireProjectRole("viewer", { anyEngine: true })
	@Delete(":projectId")
	@HttpCode(204)
	delete(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<void> {
		if (!canDeleteProject(access)) {
			throw new WorkspacePermissionDeniedError();
		}

		return this.projectsService.delete(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}
}
