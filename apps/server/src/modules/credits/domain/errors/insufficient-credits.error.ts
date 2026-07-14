import { HttpException, HttpStatus } from "@nestjs/common";

export const INSUFFICIENT_CREDITS_ERROR_CODE = "INSUFFICIENT_CREDITS";

export class InsufficientCreditsError extends HttpException {
	constructor(required: number, available: number) {
		super(
			{
				available,
				code: INSUFFICIENT_CREDITS_ERROR_CODE,
				message: `Insufficient credits: required ${required}, available ${available}`,
				required,
			},
			HttpStatus.PAYMENT_REQUIRED,
		);
	}
}
