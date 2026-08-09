export class TerminalDomainFulfillmentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TerminalDomainFulfillmentError";
	}
}

export class MissingDomainPaymentOrderError extends TerminalDomainFulfillmentError {
	constructor() {
		super("Payment order is missing for this domain purchase");
		this.name = "MissingDomainPaymentOrderError";
	}
}

export class OrderFulfillmentStoppedError extends Error {
	constructor(readonly reason: "financial_race" | "order_not_fulfillable") {
		super(
			reason === "financial_race"
				? "Payment order changed after registrar registration"
				: "Payment order is no longer eligible for registrar registration",
		);
		this.name = "OrderFulfillmentStoppedError";
	}
}

const SAFE_DOMAIN_ERROR_CODES = new Set([
	"DOMAIN_ALREADY_EXISTS",
	"DOMAIN_BLOCKED",
	"DOMAIN_NOT_AVAILABLE",
	"DOMAIN_PROVIDER_ERROR",
	"DOMAIN_RATE_LIMITED",
	"DOMAIN_VERIFICATION_PENDING",
	"DOMAINS_NOT_CONFIGURED",
	"DOMAINS_TEMPORARILY_UNAVAILABLE",
	"INVALID_DOMAIN_STATE",
	"PREMIUM_DOMAIN_BLOCKED",
]);

export function isImmediateTerminalDomainError(error: unknown): boolean {
	return (
		error instanceof TerminalDomainFulfillmentError ||
		isNonRetryableProviderError(error)
	);
}

export function domainFailureSummary(error: unknown): string {
	if (error instanceof TerminalDomainFulfillmentError) {
		return error.message;
	}

	if (hasHttpResponse(error)) {
		const response = error.getResponse();

		if (
			typeof response === "object" &&
			response !== null &&
			"code" in response &&
			typeof response.code === "string" &&
			SAFE_DOMAIN_ERROR_CODES.has(response.code) &&
			"message" in response &&
			typeof response.message === "string"
		) {
			return response.message;
		}
	}

	return "Domain registration failed";
}

function isNonRetryableProviderError(
	error: unknown,
): error is { retryable: false } {
	return (
		typeof error === "object" &&
		error !== null &&
		"retryable" in error &&
		error.retryable === false
	);
}

function hasHttpResponse(
	error: unknown,
): error is Error & { getResponse(): unknown } {
	return (
		error instanceof Error &&
		"getResponse" in error &&
		typeof error.getResponse === "function"
	);
}
