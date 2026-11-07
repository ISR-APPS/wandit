/**
 * Workspace errors with their API codes: permission, scope kind, and invite links.
 * The workspace guard, the workspace controllers, and the sharing services throw them.
 */
import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";

export const WORKSPACE_PERMISSION_DENIED_ERROR_CODE =
	"WORKSPACE_PERMISSION_DENIED";

export class WorkspacePermissionDeniedError extends ForbiddenException {
	constructor() {
		super({
			code: WORKSPACE_PERMISSION_DENIED_ERROR_CODE,
			message: "Your workspace role does not allow this action",
		});
	}
}

export const WORKSPACE_NOT_SUPPORTED_ERROR_CODE = "WORKSPACE_NOT_SUPPORTED";

/**
 * Thrown by routes that only operate on a specific scope kind: legacy
 * generation endpoints reject org scope (they are personal-only by design),
 * and org-only routes (member limits) reject personal scope.
 */
export class WorkspaceNotSupportedError extends BadRequestException {
	constructor(message = "This operation is not available in this workspace") {
		super({
			code: WORKSPACE_NOT_SUPPORTED_ERROR_CODE,
			message,
		});
	}
}

/**
 * 404 for an unknown, revoked, or expired link, or a link to a project that is gone.
 * The join page shows one message for all of them, so a token reveals nothing more.
 */
export class InviteLinkInvalidError extends NotFoundException {
	constructor() {
		super({
			code: "INVITE_LINK_INVALID",
			message: "This invite link is not valid",
		});
	}
}

/** 403 when the session email is not verified. Links and invitations need a verified owner of the email. */
export class EmailNotVerifiedError extends ForbiddenException {
	constructor() {
		super({
			code: "FORBIDDEN",
			message: "Verify your email first",
		});
	}
}
