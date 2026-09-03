import { looksLikeCredential } from "../../ai-errors/domain/sanitize-provider-text";

const MAX_ERROR_MESSAGE_LENGTH = 500;
const MAX_ERROR_CODE_LENGTH = 80;
const SAFE_ERROR_MESSAGE = "Provider tool execution failed";

export type SanitizedConnectorOperationError = {
	errorCode: string | null;
	errorMessage: string;
};

/**
 * Extract only conventional error fields, then aggressively redact common
 * secret and PII shapes. Never serialize the complete provider payload: MCP
 * errors can echo request arguments, OAuth tokens, or customer data.
 */
export function sanitizeConnectorOperationError(
	error: unknown,
): SanitizedConnectorOperationError {
	return {
		errorCode: extractErrorCode(error),
		errorMessage: SAFE_ERROR_MESSAGE.slice(0, MAX_ERROR_MESSAGE_LENGTH),
	};
}

function extractErrorCode(error: unknown): string | null {
	let current = error;

	for (let depth = 0; depth < 4 && isRecord(current); depth += 1) {
		for (const key of ["code", "statusCode", "status"] as const) {
			const value = readProperty(current, key);
			const candidate =
				typeof value === "number" && Number.isFinite(value)
					? String(value)
					: typeof value === "string"
						? value.trim()
						: "";

			const normalized = normalizeErrorCode(candidate);
			if (normalized) return normalized;
		}

		current = readProperty(current, "error") ?? readProperty(current, "cause");
	}

	return null;
}

function normalizeErrorCode(candidate: string): string | null {
	if (
		candidate.length === 0 ||
		candidate.length > MAX_ERROR_CODE_LENGTH ||
		!/^[A-Za-z0-9_.:-]+$/.test(candidate) ||
		looksLikeCredential(candidate)
	) {
		return null;
	}

	if (/^[1-5]\d{2}$/.test(candidate)) return candidate;

	const upper = candidate.toUpperCase();
	if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(upper)) {
		return upper;
	}
	if (/(?:TIMEOUT|TIMED_OUT)/.test(upper)) return "TIMEOUT";
	if (/(?:RATE|RESOURCE_EXHAUSTED|TOO_MANY)/.test(upper)) {
		return "RATE_LIMIT";
	}
	if (/(?:UNAUTH|AUTHENT|TOKEN_EXPIRED)/.test(upper)) {
		return "AUTHENTICATION";
	}
	if (/(?:PERMISSION|FORBIDDEN|ACCESS_DENIED)/.test(upper)) {
		return "PERMISSION_DENIED";
	}
	if (/(?:NOT_FOUND|NOTFOUND)/.test(upper)) return "NOT_FOUND";
	if (/(?:INVALID|VALIDATION|BAD_REQUEST|ARGUMENT)/.test(upper)) {
		return "INVALID_REQUEST";
	}
	if (/REJECT/.test(upper)) return "PROVIDER_REJECTED";
	if (
		/(?:UPSTREAM|UNAVAILABLE|INTERNAL|PROVIDER|GATEWAY|SERVICE)/.test(upper)
	) {
		return "UPSTREAM_FAILURE";
	}

	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readProperty(value: Record<string, unknown>, key: string): unknown {
	try {
		return value[key];
	} catch {
		return undefined;
	}
}
