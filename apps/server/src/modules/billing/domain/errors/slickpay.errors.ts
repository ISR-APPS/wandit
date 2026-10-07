/**
 * HTTP errors of the SlickPay checkout. SlickpayPaymentsService throws them.
 * Each code is in apiErrorCodes, so the web shows a translated message.
 */
import { HttpException, HttpStatus } from "@nestjs/common";

/** 503: the API has no `SLICKPAY_PUBLIC_KEY`, so SlickPay is off. */
export class SlickpayNotConfiguredError extends HttpException {
	constructor() {
		super(
			{
				code: "SLICKPAY_NOT_CONFIGURED",
				message: "SlickPay payments are not configured",
			},
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

/** 502: SlickPay did not create the invoice. `cause` is the client error, so Sentry shows the real reason. */
export class SlickpayUnavailableError extends HttpException {
	constructor(cause: unknown) {
		super(
			{
				code: "SLICKPAY_UNAVAILABLE",
				message: "SlickPay could not create the payment. Try again later.",
			},
			HttpStatus.BAD_GATEWAY,
			{ cause },
		);
	}
}

/** 429: the user started too many SlickPay checkouts in a short time. Each checkout is a real SlickPay invoice. */
export class SlickpayTooManyCheckoutsError extends HttpException {
	constructor() {
		super(
			{
				code: "RATE_LIMITED",
				message: "Too many payment attempts. Wait a few minutes and try again.",
			},
			HttpStatus.TOO_MANY_REQUESTS,
		);
	}
}
