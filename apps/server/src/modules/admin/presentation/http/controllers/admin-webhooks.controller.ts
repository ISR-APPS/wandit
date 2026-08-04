import {
	Controller,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { AdminWebhookReplayResponse } from "@wandit/contracts";

import { CurrentUser } from "../../../../auth";
import { AdminWebhookReplayService } from "../../../application/services/admin-webhook-replay.service";
import { AdminGuard } from "../guards/admin.guard";

@Controller("v1/admin/webhooks")
@UseGuards(AdminGuard)
export class AdminWebhooksController {
	constructor(
		@Inject(AdminWebhookReplayService)
		private readonly replayService: AdminWebhookReplayService,
	) {}

	@Post(":id/replay")
	@HttpCode(HttpStatus.ACCEPTED)
	replay(
		@Param("id") eventId: string,
		@CurrentUser() admin: AuthUser,
	): Promise<AdminWebhookReplayResponse> {
		return this.replayService.enqueue(admin.id, eventId);
	}
}
