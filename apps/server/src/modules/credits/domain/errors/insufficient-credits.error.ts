import { HttpException, HttpStatus } from "@nestjs/common";

export const INSUFFICIENT_CREDITS_ERROR_CODE = "INSUFFICIENT_CREDITS";

export class InsufficientCreditsError extends HttpException {
	constructor(
		readonly requiredCredits: number,
		readonly availableCredits: number,
	) {
		super(
			{
				code: INSUFFICIENT_CREDITS_ERROR_CODE,
				details: { availableCredits, requiredCredits },
				message: `Insufficient credits: required ${requiredCredits}, available ${availableCredits}`,
			},
			HttpStatus.PAYMENT_REQUIRED,
		);
	}
}
