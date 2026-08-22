import type {
	MemberCreditLimitDetails,
	PaymentRequiredDetails,
} from "@wandit/contracts";

const BILLING_ERROR_CODES = new Set([
	"INSUFFICIENT_CREDITS",
	"GENERATION_PAYMENT_REQUIRED",
]);

export type OutOfCreditsIntent = PaymentRequiredDetails & {
	code: "INSUFFICIENT_CREDITS" | "GENERATION_PAYMENT_REQUIRED";
};

/**
 * The org member-limit refusal (403): the workspace pool could pay, but the
 * acting member's monthly cap could not. Buying credits is not the fix, so
 * the banner shows a distinct notice instead of the top-up nudge.
 */
export type MemberLimitIntent = MemberCreditLimitDetails & {
	code: "MEMBER_CREDIT_LIMIT_REACHED";
};

export type BillingErrorIntent = OutOfCreditsIntent | MemberLimitIntent;

/**
 * Normalize both billing error sources the chat can produce (web parity with
 * billing-error-dispatch.ts, minus the listener bus — the native banner reads
 * hook state directly):
 * - an HTTP ApiClientError-like value (402/403 on the send itself);
 * - an AI SDK `data-billing-error` message part (mid-stream refusal).
 */
export function toBillingErrorIntent(
	source: unknown,
): BillingErrorIntent | null {
	const candidate = unwrapBillingErrorSource(source);

	if (!candidate) {
		return null;
	}

	if (
		candidate.statusCode === 403 &&
		candidate.code === "MEMBER_CREDIT_LIMIT_REACHED" &&
		isMemberLimitDetails(candidate.details)
	) {
		return {
			code: "MEMBER_CREDIT_LIMIT_REACHED",
			limitCredits: candidate.details.limitCredits,
			spentCredits: candidate.details.spentCredits,
			requiredCredits: candidate.details.requiredCredits,
		};
	}

	if (candidate.statusCode !== 402) {
		return null;
	}

	if (
		typeof candidate.code !== "string" ||
		!BILLING_ERROR_CODES.has(candidate.code) ||
		!isPaymentRequiredDetails(candidate.details)
	) {
		return null;
	}

	return {
		code: candidate.code as OutOfCreditsIntent["code"],
		requiredCredits: candidate.details.requiredCredits,
		availableCredits: candidate.details.availableCredits,
	};
}

function unwrapBillingErrorSource(
	source: unknown,
): Record<string, unknown> | null {
	if (!isRecord(source)) {
		return null;
	}

	if (source.type === "data-billing-error" && isRecord(source.data)) {
		return source.data;
	}

	return source;
}

// Decimal credits (pricing v4): charges and balances carry fractions, and a
// balance can go negative after accepted overage — so only require finite
// numbers with the contract's sign constraints, never integers.
function isPaymentRequiredDetails(
	value: unknown,
): value is PaymentRequiredDetails {
	return (
		isRecord(value) &&
		isFiniteNumber(value.requiredCredits) &&
		value.requiredCredits > 0 &&
		isFiniteNumber(value.availableCredits)
	);
}

function isMemberLimitDetails(
	value: unknown,
): value is MemberCreditLimitDetails {
	return (
		isRecord(value) &&
		isFiniteNumber(value.limitCredits) &&
		value.limitCredits > 0 &&
		isFiniteNumber(value.spentCredits) &&
		value.spentCredits >= 0 &&
		isFiniteNumber(value.requiredCredits) &&
		value.requiredCredits > 0
	);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
