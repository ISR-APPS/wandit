import { HttpException, HttpStatus } from "@nestjs/common";

export const NO_ACTIVE_SUBSCRIPTION_ERROR_CODE = "NO_ACTIVE_SUBSCRIPTION";

export class NoActiveSubscriptionError extends HttpException {
	constructor() {
		super(
			{
				code: NO_ACTIVE_SUBSCRIPTION_ERROR_CODE,
				message: "No active subscription exists",
			},
			HttpStatus.NOT_FOUND,
		);
	}
}
