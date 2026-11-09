/**
 * `/api/v2/project-invitations`: the invitee side of project email invitations.
 * The pending invitations banner and the page `/project-invite/<id>` call them.
 * They call ProjectInvitationsService, which answers 404 unless the caller is the verified recipient.
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
	type AcceptProjectInvitationResponse,
	type ListReceivedProjectInvitationsResponse,
	type ReceivedProjectInvitation,
	uuidSchema,
} from "@wandit/contracts";

import { CurrentUser } from "../../../../auth";
import { OrganizationsEnabledGuard } from "../../../../settings";
import { ProjectInvitationsService } from "../../../application/services/project-invitations.service";
import { ProjectInvitationInvalidError } from "../../../domain/errors/project-sharing.errors";

// No V2BuilderEnabledGuard on purpose: an invitee often lacks the rollout flag,
// and these routes read only the caller's own invitations.
/** Routes under `/api/v2/project-invitations`. A malformed id answers 404 like an unknown one. */
@Controller("v2/project-invitations")
export class ProjectInvitationsController {
	constructor(
		@Inject(ProjectInvitationsService)
		private readonly invitations: ProjectInvitationsService,
	) {}

	@Get()
	list(
		@CurrentUser() user: AuthUser,
	): Promise<ListReceivedProjectInvitationsResponse> {
		return this.invitations.listReceived(user);
	}

	@Get(":invitationId")
	get(
		@Param("invitationId") invitationId: string,
		@CurrentUser() user: AuthUser,
	): Promise<ReceivedProjectInvitation> {
		return this.invitations.getReceived(user, parseInvitationId(invitationId));
	}

	// Accepting is new collaboration, so the toggle stops it (workspaces-sharing.md 3.4).
	@UseGuards(OrganizationsEnabledGuard)
	@Post(":invitationId/accept")
	@HttpCode(HttpStatus.OK)
	accept(
		@Param("invitationId") invitationId: string,
		@CurrentUser() user: AuthUser,
	): Promise<AcceptProjectInvitationResponse> {
		return this.invitations.accept(user, parseInvitationId(invitationId));
	}

	@Post(":invitationId/decline")
	@HttpCode(HttpStatus.NO_CONTENT)
	decline(
		@Param("invitationId") invitationId: string,
		@CurrentUser() user: AuthUser,
	): Promise<void> {
		return this.invitations.decline(user, parseInvitationId(invitationId));
	}
}

// A malformed id answers the same 404 as an unknown one.
function parseInvitationId(invitationId: string): string {
	const parsed = uuidSchema.safeParse(invitationId);
	if (!parsed.success) {
		throw new ProjectInvitationInvalidError();
	}
	return parsed.data;
}
