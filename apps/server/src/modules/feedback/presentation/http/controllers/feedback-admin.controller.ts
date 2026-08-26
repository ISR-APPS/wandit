import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Patch,
	Query,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminFeedbackDetail,
	type AdminFeedbackStats,
	type AdminListFeedbackQuery,
	type AdminListFeedbackResponse,
	type AdminUpdateFeedbackInput,
	adminListFeedbackQuerySchema,
	adminUpdateFeedbackInputSchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { AdminPermission } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { CurrentUser } from "../../../../auth";
import { FeedbackAdminService } from "../../../application/services/feedback-admin.service";

@Controller("v1/admin/feedback")
@AdminOnly()
@AdminPermission({ feedback: ["read"] })
export class FeedbackAdminController {
	constructor(
		@Inject(FeedbackAdminService)
		private readonly service: FeedbackAdminService,
	) {}

	@Get()
	list(
		@Query(new ZodValidationPipe(adminListFeedbackQuerySchema))
		query: AdminListFeedbackQuery,
	): Promise<AdminListFeedbackResponse> {
		return this.service.list(query);
	}

	@Get("stats")
	stats(): Promise<AdminFeedbackStats> {
		return this.service.stats();
	}

	@Get(":feedbackId")
	detail(
		@Param("feedbackId", new ZodValidationPipe(uuidSchema)) feedbackId: string,
	): Promise<AdminFeedbackDetail> {
		return this.service.get(feedbackId);
	}

	@Patch(":feedbackId")
	@AdminPermission({ feedback: ["manage"] })
	update(
		@Param("feedbackId", new ZodValidationPipe(uuidSchema)) feedbackId: string,
		@Body(new ZodValidationPipe(adminUpdateFeedbackInputSchema))
		body: AdminUpdateFeedbackInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminFeedbackDetail> {
		return this.service.update(feedbackId, body, admin.id);
	}
}
