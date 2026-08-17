import { Module } from "@nestjs/common";

import { FeedbackService } from "./application/services/feedback.service";
import { LinearClient } from "./infrastructure/linear/linear.client";
import { FeedbackController } from "./presentation/http/controllers/feedback.controller";
import { FeedbackRateLimitGuard } from "./presentation/http/guards/rate-limit.guard";

// Feedback writes to Linear only. It needs no database access.
@Module({
	controllers: [FeedbackController],
	providers: [FeedbackRateLimitGuard, FeedbackService, LinearClient],
})
export class FeedbackModule {}
