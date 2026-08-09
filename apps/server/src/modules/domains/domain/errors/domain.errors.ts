import { HttpException, HttpStatus } from "@nestjs/common";

export class DomainHttpError extends HttpException {
	constructor(code: string, message: string, status: HttpStatus) {
		super({ code, message }, status);
	}
}

export class DomainsNotConfiguredError extends DomainHttpError {
	constructor(_missingVar?: string) {
		super(
			"DOMAINS_NOT_CONFIGURED",
			"Custom domains are not configured",
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

export class DomainsUnavailableError extends DomainHttpError {
	constructor(message = "Custom domains are temporarily unavailable") {
		super(
			"DOMAINS_TEMPORARILY_UNAVAILABLE",
			message,
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

export class DomainNotAvailableError extends DomainHttpError {
	constructor(name: string) {
		super(
			"DOMAIN_NOT_AVAILABLE",
			`${name} is not available`,
			HttpStatus.CONFLICT,
		);
	}
}

export class PremiumDomainBlockedError extends DomainHttpError {
	constructor(name: string) {
		super(
			"PREMIUM_DOMAIN_BLOCKED",
			`${name} is premium or above the v1 price ceiling`,
			HttpStatus.UNPROCESSABLE_ENTITY,
		);
	}
}

export class DomainAlreadyExistsError extends DomainHttpError {
	constructor(name: string) {
		super(
			"DOMAIN_ALREADY_EXISTS",
			`${name} is already connected to Wandit`,
			HttpStatus.CONFLICT,
		);
	}
}

export class DomainBlockedError extends DomainHttpError {
	constructor(message = "Domain name is blocked") {
		super("DOMAIN_BLOCKED", message, HttpStatus.BAD_REQUEST);
	}
}

export class InvalidDomainStateError extends DomainHttpError {
	constructor(message = "Domain is not in a valid state for this action") {
		super("INVALID_DOMAIN_STATE", message, HttpStatus.CONFLICT);
	}
}

export class DomainVerificationPendingError extends DomainHttpError {
	constructor(message = "Domain verification is still pending") {
		super(
			"DOMAIN_VERIFICATION_PENDING",
			message,
			HttpStatus.UNPROCESSABLE_ENTITY,
		);
	}
}

export class DomainProviderError extends DomainHttpError {
	readonly retryable: boolean;
	readonly upstreamStatus?: number;

	constructor(
		message = "Domain provider request failed",
		options: { retryable?: boolean; upstreamStatus?: number } = {},
	) {
		super("DOMAIN_PROVIDER_ERROR", message, HttpStatus.BAD_GATEWAY);
		this.retryable = options.retryable ?? true;
		this.upstreamStatus = options.upstreamStatus;
	}
}

export class DomainRateLimitExceededError extends DomainHttpError {
	constructor(message = "Too many domain requests; try again later") {
		super("DOMAIN_RATE_LIMITED", message, HttpStatus.TOO_MANY_REQUESTS);
	}
}
