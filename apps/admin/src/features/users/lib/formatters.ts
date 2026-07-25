import type { Currency } from "../api/users.dto";

export function formatMinorCurrency(
	amountMinor: number,
	currency: Currency | null,
	locale = "en-US",
) {
	if (!currency) {
		return "—";
	}

	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
	}).format(amountMinor / 100);
}

export function formatCompactNumber(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

export function formatWholeNumber(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	}).format(value);
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

export function formatAdminDateTime(value: string, locale = "en-US") {
	return formatAdminDate(value, locale, {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}
