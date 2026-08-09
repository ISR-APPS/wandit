import { ForbiddenException } from "@nestjs/common";

export const SUBSCRIPTIONS_DISABLED_ERROR_CODE = "SUBSCRIPTIONS_DISABLED";

export class SubscriptionsDisabledError extends ForbiddenException {
	constructor() {
		super({
			code: SUBSCRIPTIONS_DISABLED_ERROR_CODE,
			message: "Paid subscriptions are disabled",
		});
	}
}
