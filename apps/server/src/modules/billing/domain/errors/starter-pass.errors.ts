/**
 * HTTP errors of a Starter pass checkout. BillingService (Stripe) and SlickpayPaymentsService throw them.
 * Each code is in apiErrorCodes, so the web shows a translated message.
 */
import { ConflictException } from "@nestjs/common";

/** 409: the pool does not need the pass. The switch is off, or the pool already has a live pass. */
export class StarterPassNotAvailableError extends ConflictException {
	constructor() {
		super({
			code: "STARTER_PASS_NOT_AVAILABLE",
			message: "This account does not need the Starter pass",
		});
	}
}

/**
 * 409: the pool has an open SlickPay Starter pass row (created, pending, or paid) younger than 30 min.
 * SlickPay cannot cancel it, so a second Starter pass page waits until the buyer pays it or the window ends.
 */
export class StarterPassSlickpayOpenError extends ConflictException {
	constructor() {
		super({
			code: "STARTER_PASS_SLICKPAY_OPEN",
			message:
				"A SlickPay payment for the Starter pass is already open. Finish it, or try again in 30 minutes.",
		});
	}
}
