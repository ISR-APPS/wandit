/**
 * Supplies labels and payment helpers to offline billing components.
 * Uses billing contracts to validate payments and calculate periods.
 */
import {
	type AdminManualPaymentInput,
	type AdminUpdateManualRequestBody,
	addBillingInterval,
	adminManualPaymentInputSchema,
	adminUpdateManualRequestBodySchema,
	type BillingInterval,
	type ManualPaymentMethod,
	type ManualSubscriptionRequestStatus,
} from "@wandit/contracts";

/** The request table and badges use the same labels and status order. */
export const MANUAL_REQUEST_STATUS_LABELS: Record<
	ManualSubscriptionRequestStatus,
	string
> = {
	pending: "Pending",
	contacted: "Contacted",
	no_answer: "No answer",
	call_back: "Call back",
	wrong_number: "Wrong number",
	awaiting_payment: "Awaiting payment",
	approved: "Approved",
	rejected: "Rejected",
	canceled: "Canceled",
};

const MAX_AMOUNT_MINOR = 1_000_000_000;

// ISO 4217 minor-unit exponent per offered currency. TND uses millimes
// (exponent 3); every other offered currency uses 2 decimal places.
const CURRENCY_MINOR_EXPONENTS: Record<string, number> = {
	DZD: 2,
	EUR: 2,
	MAD: 2,
	TND: 3,
	USD: 2,
};

export function currencyMinorFactor(currency: string): number {
	return 10 ** (CURRENCY_MINOR_EXPONENTS[currency.toUpperCase()] ?? 2);
}

export const MANUAL_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> =
	{
		cash_on_delivery: "Cash on delivery",
		bank_transfer: "Bank transfer",
		ccp: "CCP",
		baridimob: "BaridiMob",
		other: "Other",
	};

export const MANUAL_PAYMENT_CURRENCIES = [
	"DZD",
	"USD",
	"EUR",
	"TND",
	"MAD",
] as const;

export const MANUAL_COUNTRY_LABELS: Record<string, string> = {
	DZ: "Algeria",
	TN: "Tunisia",
	MA: "Morocco",
	OTHER: "Other",
};

export type ManualPaymentFormInput = {
	method: ManualPaymentMethod;
	majorAmount: string;
	currency: string;
	reference: string;
	note: string;
};

/** Convert a major-unit form value to the integer minor-unit contract value. */
export function amountToMinorUnits(
	value: string | number,
	currency = "DZD",
): number | null {
	if (typeof value === "string" && value.trim().length === 0) {
		return null;
	}

	const major = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(major) || major < 0) {
		return null;
	}

	const minor = Math.round(major * currencyMinorFactor(currency));
	if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR) {
		return null;
	}

	return minor;
}

/** Map and validate the payment form before it enters a mutation payload. */
export function mapManualPaymentFormDto(
	input: ManualPaymentFormInput,
): AdminManualPaymentInput | null {
	const amountMinor = amountToMinorUnits(input.majorAmount, input.currency);
	if (amountMinor === null) {
		return null;
	}

	const result = adminManualPaymentInputSchema.safeParse({
		method: input.method,
		amountMinor,
		currency: input.currency,
		reference: trimmedOptional(input.reference),
		note: trimmedOptional(input.note),
	});

	return result.success ? result.data : null;
}

/** Compute the default funded period with the shared UTC calendar helper. */
export function computeDefaultPeriod(
	periodStart: Date,
	interval: BillingInterval,
) {
	return {
		periodStart,
		periodEnd: addBillingInterval(periodStart, interval),
	};
}

/** Renew live periods from their end; restart expired periods from now. */
export function computeDefaultRenewalEnd(
	currentPeriodEnd: string | null,
	interval: BillingInterval,
	now = new Date(),
	entitled = true,
) {
	const parsedEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
	const hasFutureEnd =
		entitled &&
		parsedEnd !== null &&
		Number.isFinite(parsedEnd.getTime()) &&
		parsedEnd.getTime() > now.getTime();
	const anchor = hasFutureEnd ? parsedEnd : now;

	return addBillingInterval(anchor, interval);
}

/** Format a Date for a local `datetime-local` input. */
export function toDateTimeLocalValue(value: Date): string {
	const pad = (part: number) => String(part).padStart(2, "0");

	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Convert a local form date back to the ISO contract representation. */
export function dateTimeLocalToIso(value: string): string | null {
	if (value.trim().length === 0) {
		return null;
	}

	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function formatManualPaymentAmount(
	amountMinor: number,
	currency: string,
): string {
	const major = amountMinor / currencyMinorFactor(currency);

	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			currencyDisplay: "code",
		}).format(major);
	} catch {
		return `${major.toLocaleString("en-US", {
			maximumFractionDigits: 2,
			minimumFractionDigits: 2,
		})} ${currency}`;
	}
}

export function daysUntil(value: string, now = new Date()): number {
	return Math.ceil((new Date(value).getTime() - now.getTime()) / 86_400_000);
}

export function trimmedOptional(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/** What the note dialog does on submit: edit the note, reject, or cancel the request. */
export type ManualRequestNoteMode = "note" | "reject" | "cancel";

/**
 * Map the note dialog form to the admin PATCH body.
 * Returns null when the note is too long, or when a reject or cancel has no reason.
 */
export function mapManualRequestNoteFormDto(
	mode: ManualRequestNoteMode,
	note: string,
): AdminUpdateManualRequestBody | null {
	const trimmedNote = note.trim();
	// A note edit may clear the note. Closing a request requires a reason for later review.
	if (mode !== "note" && trimmedNote.length === 0) {
		return null;
	}

	const result = adminUpdateManualRequestBodySchema.safeParse(
		mode === "note"
			? { adminNotes: trimmedNote || null }
			: {
					status: mode === "reject" ? "rejected" : "canceled",
					adminNotes: trimmedNote,
				},
	);

	return result.success ? result.data : null;
}
