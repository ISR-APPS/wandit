import { Controller, Get, Inject } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";

import { CurrentUser } from "../../../../auth";
import { SupportService } from "../../../application/services/support.service";

@Controller("v1/support")
export class SupportController {
	constructor(
		@Inject(SupportService) private readonly supportService: SupportService,
	) {}

	// Global AuthGuard applies: 401 without a session. Returns the payload
	// the Chatwoot widget needs to identify (and verify) the signed-in user.
	@Get("chat-identity")
	chatIdentity(@CurrentUser() user: AuthUser) {
		return this.supportService.chatIdentity(user);
	}
}
