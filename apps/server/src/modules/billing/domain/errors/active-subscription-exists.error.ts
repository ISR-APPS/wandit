import { HttpException, HttpStatus } from "@nestjs/common";

export const ACTIVE_SUBSCRIPTION_EXISTS_ERROR_CODE = "ALREADY_SUBSCRIBED";

export class ActiveSubscriptionExistsError extends HttpException {
	constructor() {
		super(
			{
				code: ACTIVE_SUBSCRIPTION_EXISTS_ERROR_CODE,
				message: "An active subscription already exists",
			},
			HttpStatus.CONFLICT,
		);
	}
}
