/**
 * Error used when the user needs subscription/credits to generate.
 *
 * This is thrown before we save a message or enqueue a job.
 */
// Nest HTTP exceptions automatically become HTTP responses.
import { HttpException, HttpStatus } from "@nestjs/common";

// Stable code for frontend/tests.
export const GENERATION_PAYMENT_REQUIRED_ERROR_CODE =
	"GENERATION_PAYMENT_REQUIRED";

// HTTP 402 is used here as "you need payment or credits".
export class GenerationPaymentRequiredError extends HttpException {
	constructor(requiredCredits: number, availableCredits: number) {
		// Include numbers so the UI can explain the problem.
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
