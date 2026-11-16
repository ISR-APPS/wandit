// Small text helpers of the shop pages: money, day, and date formats, initials, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** ISO 4217 code of every amount in the sample orders. A later database gives the currency of the shop. */
export const CURRENCY = "USD";

/**
 * A money format. "whole" drops the cents for large figures and chart axes.
 * Tables and order totals use "cents", so every amount of a column has the same width.
 */
export function moneyFormat(
	locale: string,
	precision: "cents" | "whole" = "cents",
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		...(precision === "whole" ? { maximumFractionDigits: 0 } : {}),
	});
}

/** A count of days in words: "30 days", "1 day". The period control and the stock cover use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
		maximumFractionDigits: 0,
	});
}

/** The day and the time of an event in one short text: "Nov 12, 9:14 PM". Order lists and timelines use it. */
export function dateTimeFormat(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/** The first letters of the first and the last word of a name, for an avatar: "Maya Okafor" gives "MO". */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/**
 * Puts values into a message: fillMessage("{count} items", { count: "4" }) gives "4 items".
 * The values are already formatted with Intl. A name with no value stays as it is.
 */
export function fillMessage(
	template: string,
	values: Record<string, string>,
): string {
	return template.replace(
		/\{(\w+)\}/g,
		(placeholder, name: string) => values[name] ?? placeholder,
	);
}
