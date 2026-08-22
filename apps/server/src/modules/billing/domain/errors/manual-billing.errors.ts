import { ConflictException, NotFoundException } from "@nestjs/common";

export const MANUAL_REQUEST_PENDING_ERROR_CODE = "MANUAL_REQUEST_PENDING";

export class ManualRequestPendingError extends ConflictException {
	constructor() {
		super({
			code: MANUAL_REQUEST_PENDING_ERROR_CODE,
			message: "An offline payment request is already pending",
		});
	}
}

export const MANUAL_SUBSCRIPTION_UNSUPPORTED_ERROR_CODE =
	"MANUAL_SUBSCRIPTION_UNSUPPORTED";

export class ManualSubscriptionUnsupportedError extends ConflictException {
	constructor() {
		super({
			code: MANUAL_SUBSCRIPTION_UNSUPPORTED_ERROR_CODE,
			message: "This subscription is managed offline. Contact us to change it.",
		});
	}
}

export class NoActiveManualRequestError extends NotFoundException {
	constructor() {
		super({
			code: "NOT_FOUND",
			message: "No active offline payment request exists",
		});
	}
}
