import { HttpException, HttpStatus } from "@nestjs/common";

export const INSUFFICIENT_CREDITS_ERROR_CODE = "INSUFFICIENT_CREDITS";

/**
 * Constructed with INTERNAL centi-credit amounts (the thrower passes ledger
 * values raw); the constructor divides by 100 exactly once, so the readonly
 * fields, the 402 details, and the message all expose decimal display credits.
 */
export class InsufficientCreditsError extends HttpException {
	/** Decimal display credits. */
	readonly requiredCredits: number;
	/** Decimal display credits. */
	readonly availableCredits: number;

	constructor(requiredCentiCredits: number, availableCentiCredits: number) {
		const requiredCredits = requiredCentiCredits / 100;
		const availableCredits = availableCentiCredits / 100;

		super(
			{
				code: INSUFFICIENT_CREDITS_ERROR_CODE,
				details: { availableCredits, requiredCredits },
				message: `Insufficient credits: required ${requiredCredits}, available ${availableCredits}`,
			},
			HttpStatus.PAYMENT_REQUIRED,
		);
		this.requiredCredits = requiredCredits;
		this.availableCredits = availableCredits;
	}
}
