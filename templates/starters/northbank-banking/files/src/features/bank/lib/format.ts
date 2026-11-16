// Text helpers that every page of the portal uses: message templates, money, and day labels.
// The page components call them with the `locale` of useT(). They read no data.
import { daysBetween } from "./bank-day";
import { BANK_CURRENCY } from "./sample-accounts";

/**
 * Puts values into a message, for example "Last {period}".
 * A name in braces with no value stays as it is, so a wrong template shows on the page.
 */
export function fillMessage(
	template: string,
	values: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
		name in values ? String(values[name]) : placeholder,
	);
}

/**
 * A count with its noun, for example "1 payment" or "12 payments".
 * `one` and `other` are messages with a {count} placeholder. Intl.PluralRules picks one for the language.
 */
export function countLabel(
	count: number,
	one: string,
	other: string,
	locale: string,
): string {
	const isOne = new Intl.PluralRules(locale).select(count) === "one";
	return fillMessage(isOne ? one : other, {
		count: new Intl.NumberFormat(locale).format(count),
	});
}

/** Cents as currency units, for Intl.NumberFormat and for a chart axis: 129_950 gives 1299.5. */
export function centsToUnits(cents: number): number {
	// 100 cents make one dollar.
	return cents / 100;
}

/**
 * A formatter for amounts in the bank currency. It takes currency units, not cents: use `centsToUnits`.
 * `fractionDigits` 2 shows the cents of a row. 0 gives the round figure of a total.
 */
export function moneyFormat(
	locale: string,
	fractionDigits: 0 | 2 = 2,
	signDisplay: "auto" | "exceptZero" = "auto",
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: BANK_CURRENCY,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
		signDisplay,
	});
}

/** A short formatter for the money ticks of a chart axis, for example "$12K". It takes currency units. */
export function compactMoneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: BANK_CURRENCY,
		notation: "compact",
		maximumFractionDigits: 1,
	});
}

/**
 * A formatter for a `dayToDate` value. `short` gives "Nov 13", `long` gives "Nov 13, 2026".
 * It reads the date in UTC, so the calendar day never moves.
 */
export function dayFormat(
	locale: string,
	length: "short" | "long" = "short",
): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		year: length === "long" ? "numeric" : undefined,
		timeZone: "UTC",
	});
}

/** A formatter for a month with its year, for example "October 2026". It reads the date in UTC. */
export function monthFormat(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

/** "today", "yesterday", or "3 days ago" for a past `day` against `today`. Both are `YYYY-MM-DD`. */
export function relativeDayLabel(
	day: string,
	today: string,
	locale: string,
): string {
	return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
		daysBetween(today, day),
		"day",
	);
}
