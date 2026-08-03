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

function isPaymentRequiredDetails(
	value: unknown,
): value is PaymentRequiredDetails {
	return (
		isRecord(value) &&
		Number.isInteger(value.requiredCredits) &&
		(value.requiredCredits as number) > 0 &&
		Number.isInteger(value.availableCredits)
	);
}

function isMemberLimitDetails(
	value: unknown,
): value is MemberCreditLimitDetails {
	return (
		isRecord(value) &&
		Number.isInteger(value.limitCredits) &&
		Number.isInteger(value.spentCredits) &&
		Number.isInteger(value.requiredCredits)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
