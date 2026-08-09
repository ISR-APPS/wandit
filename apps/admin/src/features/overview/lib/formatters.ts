import type { OverviewCurrency } from "../api/overview.dto";

export function formatOverviewCurrencyMinor(
	amountMinor: number,
	currency: OverviewCurrency,
	locale = "en-US",
) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		minimumFractionDigits: 0,
		maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
	}).format(amountMinor / 100);
}

export function formatOverviewUsdMinor(amountMinor: number, locale = "en-US") {
	return formatOverviewCurrencyMinor(amountMinor, "USD", locale);
}

export function formatOverviewRoundedCurrencyMinor(
	amountMinor: number,
	currency: OverviewCurrency,
	locale = "en-US",
) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		maximumFractionDigits: 0,
	}).format(amountMinor / 100);
}

export function formatOverviewRoundedUsdMinor(
	amountMinor: number,
	locale = "en-US",
) {
	return formatOverviewRoundedCurrencyMinor(amountMinor, "USD", locale);
}

export function formatOverviewCompactCurrency(
	amountMinor: number,
	currency: OverviewCurrency,
	locale = "en-US",
) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(amountMinor / 100);
}

export function formatOverviewCompactNumber(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

export function formatOverviewWholeNumber(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatOverviewPercent(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: value === 0 ? "auto" : "always",
		maximumFractionDigits: 1,
	}).format(value / 100);
}

export function formatOverviewPercentValue(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(value / 100);
}

export function formatOverviewLatency(durationMs: number, locale = "en-US") {
	const seconds = durationMs / 1_000;

	if (seconds < 60) {
		const formattedSeconds = new Intl.NumberFormat(locale, {
			maximumFractionDigits: seconds < 10 ? 1 : 0,
		}).format(seconds);

		return `${formattedSeconds}s`;
	}

	return `${new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
	}).format(seconds / 60)}m`;
}

export function formatOverviewDateLabel(value: string, locale = "en-US") {
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	}).format(new Date(value));
}

export function formatOverviewUpdatedAt(value: string, locale = "en-US") {
	const formattedDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		timeZone: "UTC",
	}).format(new Date(value));

	return `Updated ${formattedDate}`;
}

export function formatOverviewDate(
	value: string,
	locale = "en-US",
	options: Intl.DateTimeFormatOptions = {
		day: "numeric",
		month: "short",
		year: "numeric",
	},
) {
	return new Intl.DateTimeFormat(locale, {
		...options,
		timeZone: "UTC",
	}).format(new Date(value));
}
