import { Controller, Get, Inject, Param, Res } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type MediaGenerationAttempt, uuidSchema } from "@wandit/contracts";
import type { FastifyReply } from "fastify";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { MediaGenerationsService } from "../../../application/services/media-generations.service";

@Controller("v1/media-generations")
export class MediaGenerationsController {
	constructor(
		@Inject(MediaGenerationsService)
		private readonly mediaGenerationsService: MediaGenerationsService,
	) {}

	@Get(":attemptId")
	attempt(
		@Param("attemptId", new ZodValidationPipe(uuidSchema))
		attemptId: string,
		@CurrentUser() user: AuthUser,
	): Promise<MediaGenerationAttempt> {
		return this.mediaGenerationsService.attempt(user.id, attemptId);
	}

	@Get(":attemptId/download")
	@SkipResponseEnvelope()
	async download(
		@Param("attemptId", new ZodValidationPipe(uuidSchema))
		attemptId: string,
		@CurrentUser() user: AuthUser,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.mediaGenerationsService.download(
			user.id,
			attemptId,
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
