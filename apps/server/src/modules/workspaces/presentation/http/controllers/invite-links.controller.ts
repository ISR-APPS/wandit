/**
 * The join routes of a workspace or project invite link: preview and accept.
 * The web join page `/join/<token>` calls them. They call InviteLinksService.
 * The token names the target, so these routes ignore the workspace header.
 */
import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AcceptInviteLinkResponse,
	type InviteLinkPreview,
	inviteLinkTokenSchema,
} from "@wandit/contracts";

import { CurrentUser } from "../../../../auth";
import { OrganizationsEnabledGuard } from "../../../../settings";
import { InviteLinksService } from "../../../application/services/invite-links.service";
import { InviteLinkInvalidError } from "../../../domain/errors/workspace.errors";

/** Routes under `/api/v1/invite-links/:token`. A bad token always answers 404 `INVITE_LINK_INVALID`. */
@Controller("v1/invite-links/:token")
export class InviteLinksController {
	constructor(
		@Inject(InviteLinksService)
		private readonly inviteLinks: InviteLinksService,
	) {}

	@Get()
	preview(
		@Param("token") token: string,
		@CurrentUser() user: AuthUser,
	): Promise<InviteLinkPreview> {
		return this.inviteLinks.preview(parseToken(token), user);
	}

	// Joining is new collaboration, so the toggle stops it (workspaces-sharing.md 3.4).
	@UseGuards(OrganizationsEnabledGuard)
	@Post("accept")
	@HttpCode(HttpStatus.OK)
	accept(
		@Param("token") token: string,
		@CurrentUser() user: AuthUser,
	): Promise<AcceptInviteLinkResponse> {
		return this.inviteLinks.accept(parseToken(token), user);
	}
}

// A malformed token answers the same 404 as an unknown one, so the join page shows one message.
function parseToken(token: string): string {
	const parsed = inviteLinkTokenSchema.safeParse(token);
	if (!parsed.success) {
		throw new InviteLinkInvalidError();
	}
	return parsed.data;
}
