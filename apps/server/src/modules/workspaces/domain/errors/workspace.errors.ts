import { BadRequestException, ForbiddenException } from "@nestjs/common";

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
