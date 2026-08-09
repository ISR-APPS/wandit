import type { Locale } from "./config";

type DateValue = Date | number | string;

function toDate(value: DateValue): Date {
	return value instanceof Date ? value : new Date(value);
}

export function formatNumber(value: number, locale: Locale): string {
	return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(
	value: DateValue,
	locale: Locale,
	opts?: Intl.DateTimeFormatOptions,
): string {
	return new Intl.DateTimeFormat(locale, opts).format(toDate(value));
}

export function formatRelativeTime(
	date: DateValue,
	locale: Locale,
	now: DateValue = new Date(),
): string {
	const diffSeconds = Math.round(
		(toDate(date).getTime() - toDate(now).getTime()) / 1000,
	);
	const absoluteSeconds = Math.abs(diffSeconds);
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

	if (absoluteSeconds < 60) {
		return formatter.format(0, "second");
	}

	if (absoluteSeconds < 3600) {
		return formatter.format(Math.round(diffSeconds / 60), "minute");
	}

	if (absoluteSeconds < 86_400) {
		return formatter.format(Math.round(diffSeconds / 3600), "hour");
	}

	if (absoluteSeconds < 604_800) {
		return formatter.format(Math.round(diffSeconds / 86_400), "day");
	}

	if (absoluteSeconds < 2_629_800) {
		return formatter.format(Math.round(diffSeconds / 604_800), "week");
	}

	if (absoluteSeconds < 31_557_600) {
		return formatter.format(Math.round(diffSeconds / 2_629_800), "month");
	}

	return formatter.format(Math.round(diffSeconds / 31_557_600), "year");
}

export function formatCurrencyDZD(value: number, locale: Locale): string {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "DZD",
	}).format(value);
}
