import {
	HttpException,
	HttpStatus,
	ServiceUnavailableException,
} from "@nestjs/common";

export class FeedbackHttpError extends HttpException {
	constructor(code: string, message: string, status: HttpStatus) {
		super({ code, message }, status);
	}
}

// 503. The API boots without Linear, so this route answers honestly.
export class FeedbackNotConfiguredError extends ServiceUnavailableException {
	constructor() {
		super({
			code: "FEEDBACK_NOT_CONFIGURED",
			message: "Feedback is not configured",
		});
	}
}

export class FeedbackProviderError extends FeedbackHttpError {
	constructor(message = "Feedback provider request failed") {
		super("FEEDBACK_PROVIDER_ERROR", message, HttpStatus.BAD_GATEWAY);
	}
}

export class FeedbackRateLimitExceededError extends FeedbackHttpError {
	constructor(message = "Too many feedback posts; try again later") {
		super("RATE_LIMITED", message, HttpStatus.TOO_MANY_REQUESTS);
	}
}
