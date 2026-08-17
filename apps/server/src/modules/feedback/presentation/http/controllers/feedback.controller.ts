import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateFeedbackRequest,
	type CreateFeedbackResponse,
	createFeedbackRequestSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { FeedbackService } from "../../../application/services/feedback.service";
import { FeedbackRateLimitGuard } from "../guards/rate-limit.guard";

@Controller("v1/feedback")
export class FeedbackController {
	constructor(
		@Inject(FeedbackService)
		private readonly feedbackService: FeedbackService,
	) {}

	@UseGuards(FeedbackRateLimitGuard)
	@Post()
	create(
		@Body(new ZodValidationPipe(createFeedbackRequestSchema))
		body: CreateFeedbackRequest,
		@CurrentUser() user: AuthUser,
	): Promise<CreateFeedbackResponse> {
		return this.feedbackService.create(user, body);
	}
}
