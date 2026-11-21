// Text helpers of the gym pages: money and day formats, and message templates.
// The cards and the pages of every feature call them. They use only Intl and string methods.
import { PLAN_CURRENCY } from "./sample-plans";

/**
 * A money format in PLAN_CURRENCY. "standard" has no cents: $8,421. "compact" gives three digits: $8.42K.
 * Tables and KPI values use standard. Chart axes use compact.
 */
export function moneyFormat(
	locale: string,
	notation: "standard" | "compact" = "standard",
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: PLAN_CURRENCY,
		...(notation === "compact"
			? { notation: "compact", maximumSignificantDigits: 3 }
			: { maximumFractionDigits: 0 }),
	});
}

/** A count of days in words: "30 days", "1 day". The period select and its description use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/**
 * Puts values into a message: fillMessage("{count} members", { count: "4" }) gives "4 members".
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
