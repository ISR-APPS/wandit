/**
 * Turns a billing refusal of the API (402 credits, 403 member limit) into one intent for the native banner.
 * The chat hook, the chat screen, and the home screen call it. It parses the reason with the contracts schema.
 */
import {
	type MemberCreditLimitDetails,
	type PaymentRequiredDetails,
	paymentRequiredDetailsSchema,
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

// Only the reason field is read here. The guard below checks the credit numbers.
const starterPassReasonSchema = paymentRequiredDetailsSchema.pick({
	reason: true,
});

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

	// The reason crosses the HTTP boundary unchecked by the guard above. Older servers omit it.
	const reason = starterPassReasonSchema.safeParse(candidate.details).data
		?.reason;
	return {
		// SAFETY: BILLING_ERROR_CODES.has(candidate.code) above holds only these two codes.
		code: candidate.code as OutOfCreditsIntent["code"],
		requiredCredits: candidate.details.requiredCredits,
		availableCredits: candidate.details.availableCredits,
		...(reason === undefined ? {} : { reason }),
	};
}

/**
 * True when the refusal comes from a pool with no Starter pass. The banner then sells the pass, not a top-up.
 * `intent` is the result of toBillingErrorIntent, or null when no refusal happened.
 */
export function isStarterPassIntent(
	intent: BillingErrorIntent | null,
): boolean {
	return (
		intent !== null &&
		intent.code !== "MEMBER_CREDIT_LIMIT_REACHED" &&
		intent.reason === "starter_pass_required"
	);
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
