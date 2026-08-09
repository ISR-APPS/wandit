/**
 * Error used when the user needs credits to generate.
 *
 * This is thrown before we save a message or enqueue a job.
 */
// Nest HTTP exceptions automatically become HTTP responses.
import { HttpException, HttpStatus } from "@nestjs/common";

// Stable code for frontend/tests.
export const GENERATION_PAYMENT_REQUIRED_ERROR_CODE =
	"GENERATION_PAYMENT_REQUIRED";

// HTTP 402 is used here as "you need more credits".
export class GenerationPaymentRequiredError extends HttpException {
	constructor(
		readonly requiredCredits: number,
		readonly availableCredits: number,
	) {
		// Include numbers so the UI can explain the problem.
		super(
			{
				code: GENERATION_PAYMENT_REQUIRED_ERROR_CODE,
				details: { availableCredits, requiredCredits },
				message: "Enough credits are required",
			},
			HttpStatus.PAYMENT_REQUIRED,
		);
	}
}
