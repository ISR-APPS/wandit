// Text helpers that every page of the ledger uses: message templates, money, and day labels.
// The page components call them with the `locale` of useT(). They read no data.
import { LEDGER_CURRENCY } from "./sample-accounts";

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
 * A count with its noun, for example "1 entry" or "12 entries".
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
	// 100 cents make one unit of the ledger currency.
	return cents / 100;
}

/**
 * A formatter for amounts in the ledger currency. It takes currency units, not cents: use `centsToUnits`.
 * `fractionDigits` 2 shows the cents of a ledger row. 0 gives the round figure of a total.
 */
export function moneyFormat(
	locale: string,
	fractionDigits: 0 | 2 = 2,
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: LEDGER_CURRENCY,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	});
}

/** A short formatter for the money ticks of a chart axis, for example "$12K". It takes currency units. */
export function compactMoneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: LEDGER_CURRENCY,
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

/** A formatter for the name of a month with its year, for example "November 2026". It reads the date in UTC. */
export function monthFormat(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

/** A formatter for a count of days, for example "30 days". The period controls and the period lines use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}
