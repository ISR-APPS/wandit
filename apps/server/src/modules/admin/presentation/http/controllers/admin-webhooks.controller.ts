import {
	Controller,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Post,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { AdminWebhookReplayResponse } from "@wandit/contracts";

import { CurrentUser } from "../../../../auth";
import { AdminWebhookReplayService } from "../../../application/services/admin-webhook-replay.service";
import { AdminOnly } from "../decorators/admin-only.decorator";

@Controller("v1/admin/webhooks")
@AdminOnly()
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
