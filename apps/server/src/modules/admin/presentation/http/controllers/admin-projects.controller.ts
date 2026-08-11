import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import {
	type AdminProjectDetail,
	type AdminProjectVersionHtmlResponse,
	type AdminProjectVersionsQuery,
	type AdminProjectVersionsResponse,
	adminProjectVersionsQuerySchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyReply } from "fastify";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminPagePreviewService } from "../../../application/services/admin-page-preview.service";
import { AdminProjectsService } from "../../../application/services/admin-projects.service";
import { AdminOnly } from "../decorators/admin-only.decorator";

@Controller("v1/admin/projects")
@AdminOnly()
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

	@Get(":projectId/versions/:versionId/preview")
	@SkipResponseEnvelope()
	async versionPreview(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("versionId", new ZodValidationPipe(uuidSchema))
		versionId: string,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const { html } = await this.adminPagePreviewService.versionHtml(
			projectId,
			versionId,
		);

		// Generated HTML is active content. Keep its scripts in an opaque origin
		// so they cannot use the admin's authenticated API session.
		await reply
			.header("Content-Type", "text/html; charset=utf-8")
			.header("Cache-Control", "private, no-store")
			.header(
				"Content-Security-Policy",
				"sandbox allow-forms allow-scripts; frame-ancestors 'none'",
			)
			.header("Referrer-Policy", "no-referrer")
			.send(html);
	}
}
