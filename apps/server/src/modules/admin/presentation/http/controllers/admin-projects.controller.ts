import {
	Controller,
	Get,
	Inject,
	Param,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	type AdminProjectDetail,
	type AdminProjectVersionHtmlResponse,
	type AdminProjectVersionsQuery,
	type AdminProjectVersionsResponse,
	adminProjectVersionsQuerySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminPagePreviewService } from "../../../application/services/admin-page-preview.service";
import { AdminProjectsService } from "../../../application/services/admin-projects.service";
import { AdminGuard } from "../guards/admin.guard";

@Controller("v1/admin/projects")
@UseGuards(AdminGuard)
export class AdminProjectsController {
	constructor(
		@Inject(AdminProjectsService)
		private readonly adminProjectsService: AdminProjectsService,
		@Inject(AdminPagePreviewService)
		private readonly adminPagePreviewService: AdminPagePreviewService,
	) {}

	@Get(":projectId")
	detail(@Param("projectId") projectId: string): Promise<AdminProjectDetail> {
		return this.adminProjectsService.getProjectDetail(projectId);
	}

	@Get(":projectId/versions")
	versions(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query(new ZodValidationPipe(adminProjectVersionsQuerySchema))
		query: AdminProjectVersionsQuery,
	): Promise<AdminProjectVersionsResponse> {
		return this.adminProjectsService.listProjectVersions(projectId, query);
	}

	@Get(":projectId/versions/:versionId/html")
	versionHtml(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("versionId", new ZodValidationPipe(uuidSchema))
		versionId: string,
	): Promise<AdminProjectVersionHtmlResponse> {
		return this.adminPagePreviewService.versionHtml(projectId, versionId);
	}
}
