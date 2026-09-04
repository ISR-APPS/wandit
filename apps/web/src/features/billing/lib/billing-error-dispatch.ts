import type {
	MemberCreditLimitDetails,
	PaymentRequiredDetails,
} from "@wandit/contracts";

const BILLING_ERROR_CODES = new Set([
	"INSUFFICIENT_CREDITS",
	"GENERATION_PAYMENT_REQUIRED",
]);

export type UpgradeModalIntent = PaymentRequiredDetails & {
	code: "INSUFFICIENT_CREDITS" | "GENERATION_PAYMENT_REQUIRED";
};

/**
 * The org member-limit refusal (403): the workspace pool could pay, but the
 * acting member's monthly cap could not. Buying credits is not the fix, so
 * it opens a dedicated notice instead of the plan picker.
 */
export type MemberLimitModalIntent = MemberCreditLimitDetails & {
	code: "MEMBER_CREDIT_LIMIT_REACHED";
};

export type BillingErrorIntent = UpgradeModalIntent | MemberLimitModalIntent;

type BillingErrorListener = (intent: BillingErrorIntent) => void;

const listeners = new Set<BillingErrorListener>();

/**
 * Normalize both billing error sources used by the app:
 * - an HTTP ApiClientError-like value;
 * - an AI SDK `data-billing-error` message part.
 */
export function toUpgradeModalIntent(
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
		code: candidate.code as UpgradeModalIntent["code"],
		requiredCredits: candidate.details.requiredCredits,
		availableCredits: candidate.details.availableCredits,
		// heldCredits is optional (older servers omit it): forward only a
		// usable value so the paywall's "on hold" row never renders garbage.
		...(isFiniteNumber(candidate.details.heldCredits) &&
		candidate.details.heldCredits >= 0
			? { heldCredits: candidate.details.heldCredits }
			: {}),
	};
}

/** Returns the normalized intent and notifies the mounted billing modal. */
export function dispatchBillingError(
	source: unknown,
): BillingErrorIntent | null {
	const intent = toUpgradeModalIntent(source);
	if (!intent) {
		return null;
	}

	for (const listener of listeners) {
		listener(intent);
	}

	return intent;
}

export function subscribeToBillingErrors(listener: BillingErrorListener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
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

// Pricing v4 details carry decimal credits (requiredCredits can be 0.1,
// availableCredits can be a negative fraction) — accept any finite number.
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
		isFiniteNumber(value.spentCredits) &&
		isFiniteNumber(value.requiredCredits)
	);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
