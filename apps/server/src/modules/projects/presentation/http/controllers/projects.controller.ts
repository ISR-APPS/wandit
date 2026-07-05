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
import { ProjectsService } from "../../../application/services/projects.service";

@Controller("v1/projects")
export class ProjectsController {
	constructor(
		@Inject(ProjectsService)
		private readonly projectsService: ProjectsService,
	) {}

	@Get()
	list(@CurrentUser() user: AuthUser): Promise<ListProjectsResponse> {
		return this.projectsService.list(user.id);
	}

	@Post()
	create(
		@Body(new ZodValidationPipe(createProjectBodySchema))
		body: CreateProjectBody,
		@CurrentUser() user: AuthUser,
	): Promise<CreateProjectResponse> {
		return this.projectsService.create(user.id, body);
	}

	@Get(":projectId")
	get(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<Project> {
		return this.projectsService.get(user.id, projectId);
	}

	@Patch(":projectId")
	update(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(updateProjectBodySchema))
		body: UpdateProjectBody,
		@CurrentUser() user: AuthUser,
	): Promise<Project> {
		return this.projectsService.update(user.id, projectId, body);
	}

	@Delete(":projectId")
	@HttpCode(204)
	delete(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<void> {
		return this.projectsService.delete(user.id, projectId);
	}
}
