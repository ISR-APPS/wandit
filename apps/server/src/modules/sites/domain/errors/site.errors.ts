import { HttpException, HttpStatus } from "@nestjs/common";

export class SiteHttpError extends HttpException {
	constructor(code: string, message: string, status: HttpStatus) {
		super({ code, message }, status);
	}
}

export class SlugTakenError extends SiteHttpError {
	constructor(slug: string) {
		super(
			"SLUG_TAKEN",
			`${slug} is already used by another live site`,
			HttpStatus.CONFLICT,
		);
	}
}

export class SlugReservedError extends SiteHttpError {
	constructor(slug: string) {
		super(
			"SLUG_RESERVED",
			`${slug} is reserved and cannot be used`,
			HttpStatus.CONFLICT,
		);
	}
}

export class NoVersionToPublishError extends SiteHttpError {
	constructor() {
		super(
			"NO_VERSION",
			"Generate a page before publishing",
			HttpStatus.UNPROCESSABLE_ENTITY,
		);
	}
}

export class PublishUnavailableError extends SiteHttpError {
	constructor() {
		super(
			"PUBLISH_UNAVAILABLE",
			"Publishing is not configured",
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

export class PublishFailedError extends SiteHttpError {
	constructor(message = "Publishing failed; nothing went live") {
		super("PUBLISH_FAILED", message, HttpStatus.BAD_GATEWAY);
	}
}
