import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type ProjectAssetsResponse, uuidSchema } from "@wandit/contracts";
import type { FastifyReply } from "fastify";
import { z } from "zod";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { ProjectAssetsService } from "../../../application/services/project-assets.service";

// R2 object keys are path-ish strings; the service re-validates the prefix
// against the owned project before anything is streamed.
const downloadKeySchema = z.string().min(1).max(1_024);

@Controller("v1")
export class ProjectAssetsController {
	constructor(
		@Inject(ProjectAssetsService)
		private readonly projectAssetsService: ProjectAssetsService,
	) {}

	@Get("projects/:projectId/assets")
	async list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<ProjectAssetsResponse> {
		return {
			assets: await this.projectAssetsService.listAssets(user.id, projectId),
		};
	}

	@Get("projects/:projectId/assets/download")
	@SkipResponseEnvelope()
	async download(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query("key", new ZodValidationPipe(downloadKeySchema))
		key: string,
		@CurrentUser() user: AuthUser,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.projectAssetsService.download(
			user.id,
			projectId,
			key,
		);

		await reply
			.header("Content-Type", download.mediaType)
			.header(
				"Content-Disposition",
				`attachment; filename="${download.fileName}"`,
			)
			.header("Cache-Control", "private, no-store")
			.send(Buffer.from(download.bytes));
	}
}
