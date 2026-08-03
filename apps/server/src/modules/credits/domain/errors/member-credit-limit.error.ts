import { ForbiddenException } from "@nestjs/common";

export const MEMBER_CREDIT_LIMIT_REACHED_ERROR_CODE =
	"MEMBER_CREDIT_LIMIT_REACHED";

/**
 * The org pool could afford the reserve, but this member's monthly credit
 * limit could not. 403 (not 402): buying credits is not the fix — a workspace
 * admin raising the limit is.
 */
export class MemberCreditLimitError extends ForbiddenException {
	constructor(
		readonly limitCredits: number,
		readonly spentCredits: number,
		readonly requiredCredits: number,
	) {
		super({
			code: MEMBER_CREDIT_LIMIT_REACHED_ERROR_CODE,
			details: { limitCredits, requiredCredits, spentCredits },
			message: `Workspace member credit limit reached: limit ${limitCredits}, spent ${spentCredits}, required ${requiredCredits}`,
		});
	}
}
