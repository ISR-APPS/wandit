import { ForbiddenException } from "@nestjs/common";

export const MEMBER_CREDIT_LIMIT_REACHED_ERROR_CODE =
	"MEMBER_CREDIT_LIMIT_REACHED";

/**
 * The org pool could afford the reserve, but this member's monthly credit
 * limit could not. 403 (not 402): buying credits is not the fix — a workspace
 * admin raising the limit is.
 *
 * Constructed with INTERNAL centi-credit amounts (throwers pass limit/spend
 * values raw); the constructor divides by 100 exactly once, so the readonly
 * fields, the 403 details, and the message all expose decimal display credits.
 */
export class MemberCreditLimitError extends ForbiddenException {
	/** Decimal display credits. */
	readonly limitCredits: number;
	/** Decimal display credits. */
	readonly spentCredits: number;
	/** Decimal display credits. */
	readonly requiredCredits: number;

	constructor(
		limitCentiCredits: number,
		spentCentiCredits: number,
		requiredCentiCredits: number,
	) {
		const limitCredits = limitCentiCredits / 100;
		const spentCredits = spentCentiCredits / 100;
		const requiredCredits = requiredCentiCredits / 100;

		super({
			code: MEMBER_CREDIT_LIMIT_REACHED_ERROR_CODE,
			details: { limitCredits, requiredCredits, spentCredits },
			message: `Workspace member credit limit reached: limit ${limitCredits}, spent ${spentCredits}, required ${requiredCredits}`,
		});
		this.limitCredits = limitCredits;
		this.spentCredits = spentCredits;
		this.requiredCredits = requiredCredits;
	}
}
