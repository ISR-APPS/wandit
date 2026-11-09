/**
 * `GET /api/v2/shared-projects`: the "Shared with me" list of the dashboard.
 * It sits behind the global AuthGuard only and ignores the workspace header.
 * It calls ProjectsService.listShared, which reads the caller's direct grants.
 */
import { Controller, Get, Inject } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { ListSharedProjectsResponse } from "@wandit/contracts";

import { CurrentUser } from "../../../../auth";
import { ProjectsService } from "../../../../projects";

// No V2BuilderEnabledGuard on purpose: invited collaborators often lack the
// rollout flag, and the route reads only the caller's own grants.
@Controller("v2/shared-projects")
export class SharedProjectsController {
	constructor(
		@Inject(ProjectsService) private readonly projects: ProjectsService,
	) {}

	@Get()
	list(@CurrentUser() user: AuthUser): Promise<ListSharedProjectsResponse> {
		return this.projects.listShared(user.id);
	}
}
