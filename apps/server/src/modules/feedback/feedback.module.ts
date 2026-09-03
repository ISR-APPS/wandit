import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AdminSecurityModule } from "../admin/admin-security.module";
import { FeedbackService } from "./application/services/feedback.service";
import { FeedbackAdminService } from "./application/services/feedback-admin.service";
import { LinearClient } from "./infrastructure/linear/linear.client";
import { FeedbackRepository } from "./infrastructure/persistence/feedback.repository";
import { FeedbackScreenshotStore } from "./infrastructure/storage/feedback-screenshot.store";
import { FeedbackController } from "./presentation/http/controllers/feedback.controller";
import { FeedbackAdminController } from "./presentation/http/controllers/feedback-admin.controller";
import { FeedbackRateLimitGuard } from "./presentation/http/guards/rate-limit.guard";

// Feedback rows live in Postgres. Linear is a best-effort mirror.
@Module({
	controllers: [FeedbackAdminController, FeedbackController],
	imports: [AdminSecurityModule, DatabaseModule],
	providers: [
		FeedbackAdminService,
		FeedbackRateLimitGuard,
		FeedbackRepository,
		FeedbackScreenshotStore,
		FeedbackService,
		LinearClient,
	],
})
export class FeedbackModule {}
