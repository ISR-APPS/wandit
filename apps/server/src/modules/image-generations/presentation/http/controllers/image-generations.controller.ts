import { Controller, Get, Inject, Param, Res } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type ImageGenerationAttempt, uuidSchema } from "@wandit/contracts";
import type { FastifyReply } from "fastify";
import { z } from "zod";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { ImageGenerationsService } from "../../../application/services/image-generations.service";

// 1-based index into the attempt's images; the contract caps count at 4.
const downloadIndexSchema = z.coerce.number().int().min(1).max(4);

@Controller("v1/image-generations")
export class ImageGenerationsController {
	constructor(
		@Inject(ImageGenerationsService)
		private readonly imageGenerationsService: ImageGenerationsService,
	) {}

	@Get(":attemptId")
	attempt(
		@Param("attemptId", new ZodValidationPipe(uuidSchema))
		attemptId: string,
		@CurrentUser() user: AuthUser,
	): Promise<ImageGenerationAttempt> {
		return this.imageGenerationsService.attempt(user.id, attemptId);
	}

	@Get(":attemptId/download/:index")
	@SkipResponseEnvelope()
	async download(
		@Param("attemptId", new ZodValidationPipe(uuidSchema))
		attemptId: string,
		@Param("index", new ZodValidationPipe(downloadIndexSchema))
		index: number,
		@CurrentUser() user: AuthUser,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.imageGenerationsService.download(
			user.id,
			attemptId,
			index,
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
