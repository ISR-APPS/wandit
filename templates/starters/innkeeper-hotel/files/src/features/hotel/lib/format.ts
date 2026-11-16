// Text helpers that every page of the hotel uses: message templates, money, days, and initials.
// The page components call them with the `locale` of useT(). They read no data.
import { HOTEL_CURRENCY } from "./sample-rooms";

/**
 * Puts values into a message, for example "Night {night} of {nights}".
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
 * A count with its noun, for example "1 night" or "3 nights".
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

/** A formatter for amounts in the hotel currency, with no cents: every sample amount is a whole number. */
export function moneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: HOTEL_CURRENCY,
		maximumFractionDigits: 0,
	});
}

/** A `YYYY-MM-DD` day as a Date at local midnight, for an Intl.DateTimeFormat. */
export function dayToDate(day: string): Date {
	// A date-time text with no offset is local time in JavaScript.
	return new Date(`${day}T00:00:00`);
}

/** The first letters of the first and the last word of a name, for an avatar: "Camille Verdier" gives "CV". */
export function initialsOf(fullName: string): string {
	const words = fullName.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}
