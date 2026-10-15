/**
 * Number, money, and date formatters for the admin tables, detail pages, and dialogs.
 * The users, organizations, offline billing, and analytics screens import them.
 */
export function formatWholeNumber(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	}).format(value);
}

// Micro-dollars (1_000_000 = $1) → money. Sub-dollar amounts keep four
// decimals so per-message AI costs ($0.0004) stay visible instead of
// rounding to $0.00.
export function formatUsdMicros(micros: number, locale = "en-US") {
	const dollars = micros / 1_000_000;

	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: Math.abs(dollars) >= 1 ? 2 : 4,
	}).format(dollars);
}

/**
 * Formats an amount in minor units of a currency, as Stripe sends it: 2000 "usd" gives "$20.00".
 * Intl knows the decimal digits of each currency, so "jpy" (0 digits) also works.
 */
export function formatMinorAmount(
	amountMinor: number,
	currency: string,
	locale = "en-US",
) {
	const formatter = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: currency.toUpperCase(),
	});
	// Intl sets the digits for every currency style. 2 only satisfies the optional lib type.
	const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;

	return formatter.format(amountMinor / 10 ** digits);
}

export function formatAdminDate(
	value: string | null,
	locale = "en-US",
	options: Intl.DateTimeFormatOptions = {
		day: "numeric",
		month: "short",
		year: "numeric",
	},
) {
	if (!value) {
		return "—";
	}

	return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatAdminDateTime(value: string | null, locale = "en-US") {
	return formatAdminDate(value, locale, {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}
