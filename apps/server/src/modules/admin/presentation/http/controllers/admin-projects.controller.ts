import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import type { AdminProjectDetail } from "@wandit/contracts";

import { AdminProjectsService } from "../../../application/services/admin-projects.service";
import { AdminGuard } from "../guards/admin.guard";

@Controller("v1/admin/projects")
@UseGuards(AdminGuard)
export class AdminProjectsController {
	constructor(
		@Inject(AdminProjectsService)
		private readonly adminProjectsService: AdminProjectsService,
	) {}

	@Get(":projectId")
	detail(@Param("projectId") projectId: string): Promise<AdminProjectDetail> {
		return this.adminProjectsService.getProjectDetail(projectId);
	}
}
