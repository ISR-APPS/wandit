/**
 * Errors of project sharing with their API codes (workspaces-sharing.md 5).
 * ProjectSharingService and ProjectInvitationsService throw them.
 */
import { ConflictException, NotFoundException } from "@nestjs/common";
import type {
	ProjectMoveBlockedDetails,
	ProjectMoveBlockedReason,
} from "@wandit/contracts";

/** 409 with `details.reason`: state of the source payer blocks the move. */
export class ProjectMoveBlockedError extends ConflictException {
	constructor(reason: ProjectMoveBlockedReason) {
		super({
			code: "PROJECT_MOVE_BLOCKED",
			details: { reason } satisfies ProjectMoveBlockedDetails,
			message: "The project cannot move now",
		});
	}
}

/**
 * 404 for an invitation that the caller cannot use: not the recipient, not
 * pending, expired, or a project that is gone. One answer reveals nothing.
 */
export class ProjectInvitationInvalidError extends NotFoundException {
	constructor() {
		super({
			code: "PROJECT_INVITATION_INVALID",
			message: "This invitation is not valid",
		});
	}
}
