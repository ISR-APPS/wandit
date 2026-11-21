/**
 * Supplies labels and payment helpers to offline billing components.
 * Uses billing contracts to validate the "Record top-up" form and to suggest its credits.
 */
import {
	type AdminManualRequest,
	type AdminRecordTopupInput,
	type AdminUpdateManualRequestBody,
	adminRecordTopupInputSchema,
	adminUpdateManualRequestBodySchema,
	type ManualPaymentMethod,
	type ManualSubscriptionRequestStatus,
	type PreferredPaymentMethod,
	topupCreditsForUsd,
	tryPriceUsdFor,
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

/**
 * English method labels for the admin tables, sheets, and payment form.
 * The API records "slickpay" payments itself. An admin picks it only to resolve a SlickPay payment by hand.
 */
export const MANUAL_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> =
	{
		cash_on_delivery: "Cash on delivery",
		bank_transfer: "Bank transfer",
		ccp: "CCP",
		baridimob: "BaridiMob",
		slickpay: "SlickPay (CIB/Edahabia)",
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

/** Values of the "Record top-up" form, as the admin types them. */
export type RecordTopupFormInput = {
	method: PreferredPaymentMethod;
	/** Money received, in major units of `currency` ("2500.00"). */
	majorAmount: string;
	/** Upper-case code from MANUAL_PAYMENT_CURRENCIES. The contract stores it in lower case. */
	currency: string;
	/** Decimal credits to grant. Empty means the API computes them from the amount. */
	credits: string;
	reference: string;
	note: string;
};

/** The pool that "Record top-up" funds, and the request it approves. */
export type RecordTopupOwner = {
	/** Contact user. Also the pool when `organizationId` is null. */
	userId: string;
	organizationId: string | null;
	/** Id of the offline request. Without it, the API approves the open request of the owner, if any. */
	requestId?: string;
};

// The API computes credits only for USD and DZD (DZD through the rate in settings).
// For another currency the admin must type the credits, or the API answers 400.
const API_PRICED_TOPUP_CURRENCIES = ["USD", "DZD"];

/** True when the API can compute the credits of a top-up in this currency, so the credits field can stay empty. */
export function apiComputesTopupCredits(currency: string): boolean {
	return API_PRICED_TOPUP_CURRENCIES.includes(currency.toUpperCase());
}

/**
 * Credits that "Record top-up" suggests for an offline request, at 10 credits for 1 USD, plus the volume bonus of topupCreditsForUsd.
 * A pricing v8 request gives its asked amount. An older request gives the price of its plan.
 * Null when the request has no whole USD value. The admin then types the credits.
 */
export function suggestedTopupCredits(
	request: Pick<
		AdminManualRequest,
		"amountUsd" | "plan" | "tierCredits" | "interval"
	>,
): number | null {
	const amountUsd =
		request.amountUsd ??
		(request.plan && request.tierCredits && request.interval
			? tryPriceUsdFor(request.plan, request.tierCredits, request.interval)
			: null);

	// topupCreditsForUsd throws on a fraction. A suggestion must never break the form.
	return amountUsd !== null && Number.isSafeInteger(amountUsd) && amountUsd > 0
		? topupCreditsForUsd(amountUsd)
		: null;
}

/** "25 USD", or "pro · 250 · month (old plan request)" for a request from before pricing v8. */
export function formatRequestedTopup(
	request: Pick<
		AdminManualRequest,
		"amountUsd" | "plan" | "tierCredits" | "interval"
	>,
): string {
	if (request.amountUsd !== null) {
		return `${request.amountUsd.toLocaleString("en-US")} USD`;
	}
	if (request.plan && request.tierCredits && request.interval) {
		return `${request.plan} · ${request.tierCredits.toLocaleString("en-US")} · ${request.interval} (old plan request)`;
	}
	return "no amount";
}

/**
 * Map and validate the "Record top-up" form. The caller adds the idempotency key.
 * Returns null when the amount is not above zero, the credits are out of range,
 * or the currency needs typed credits and the field is empty.
 */
export function mapRecordTopupFormDto(
	form: RecordTopupFormInput,
	owner: RecordTopupOwner,
): Omit<AdminRecordTopupInput, "idempotencyKey"> | null {
	const amountMinor = amountToMinorUnits(form.majorAmount, form.currency);
	const creditsText = form.credits.trim();
	if (
		amountMinor === null ||
		(creditsText.length === 0 && !apiComputesTopupCredits(form.currency))
	) {
		return null;
	}

	const result = adminRecordTopupInputSchema
		.omit({ idempotencyKey: true })
		.safeParse({
			userId: owner.userId,
			organizationId: owner.organizationId,
			requestId: owner.requestId,
			amountMinor,
			currency: form.currency,
			method: form.method,
			reference: trimmedOptional(form.reference),
			note: trimmedOptional(form.note),
			credits: creditsText.length > 0 ? Number(creditsText) : undefined,
		});

	return result.success ? result.data : null;
}

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

function trimmedOptional(value: string): string | undefined {
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
