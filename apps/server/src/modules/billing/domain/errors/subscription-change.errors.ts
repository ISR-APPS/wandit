import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";

export class SubscriptionChangePendingError extends ConflictException {
	constructor() {
		super({
			code: "SUBSCRIPTION_CHANGE_PENDING",
			message: "A subscription change is already awaiting payment",
		});
	}
}

export class BillingChangeIntentExpiredError extends ConflictException {
	constructor() {
		super({
			code: "BILLING_CHANGE_INTENT_EXPIRED",
			message: "The billing change preview has expired",
		});
	}
}

export class BillingChangeIntentInvalidError extends NotFoundException {
	constructor() {
		super({
			code: "BILLING_CHANGE_INTENT_INVALID",
			message: "The billing change preview is invalid or already used",
		});
	}
}

export class YearlyToMonthlyUnsupportedError extends BadRequestException {
	constructor() {
		super({
			code: "YEARLY_TO_MONTHLY_UNSUPPORTED",
			message: "Changing a yearly subscription to monthly is not supported",
		});
	}
}
