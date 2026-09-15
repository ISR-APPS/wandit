/**
 * 409 for a turn create that arrives while an approval card still waits.
 * `turns.service.ts` throws it when the previous turn paused on a
 * `data-approval` card and the request has no `approval` answer. The
 * API exception filter renders it as the `BUILDER_APPROVAL_PENDING`
 * envelope.
 */
import { ConflictException } from "@nestjs/common";

/** Stable machine code the client reads to show the pending approval card. */
export const BUILDER_APPROVAL_PENDING_ERROR_CODE = "BUILDER_APPROVAL_PENDING";

/** Thrown when a new turn arrives before the approval card is answered. */
export class BuilderApprovalPendingError extends ConflictException {
	constructor() {
		super({
			code: BUILDER_APPROVAL_PENDING_ERROR_CODE,
			message: "Answer the approval card first",
		});
	}
}
