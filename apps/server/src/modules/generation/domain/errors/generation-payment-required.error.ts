import { HttpException, HttpStatus } from "@nestjs/common";

export const GENERATION_PAYMENT_REQUIRED_ERROR_CODE =
	"GENERATION_PAYMENT_REQUIRED";

export class GenerationPaymentRequiredError extends HttpException {
	constructor(requiredCredits: number, availableCredits: number) {
		super(
			{
				availableCredits,
				code: GENERATION_PAYMENT_REQUIRED_ERROR_CODE,
				message: "An active subscription or enough credits are required",
				requiredCredits,
			},
			HttpStatus.PAYMENT_REQUIRED,
		);
	}
}
