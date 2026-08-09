import { HttpException, HttpStatus } from "@nestjs/common";

export const PAYMENT_PAST_DUE_ERROR_CODE = "PAYMENT_PAST_DUE";

export class PaymentPastDueError extends HttpException {
	constructor() {
		super(
			{
				code: PAYMENT_PAST_DUE_ERROR_CODE,
				message:
					"Your subscription payment needs attention. Update it in the billing portal.",
			},
			HttpStatus.CONFLICT,
		);
	}
}
