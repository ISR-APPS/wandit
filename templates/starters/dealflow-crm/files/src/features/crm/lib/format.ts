// Small text helpers of the CRM pages: money and day formats, initials, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** ISO 4217 code of every amount in the sample deals. A later database gives the currency of the business. */
export const CURRENCY = "USD";

/**
 * A money format with no cents. "compact" gives three digits and a unit: $48.5K, $1.28M.
 * Column heads and summaries use compact. Tables and detail pages use the full amount.
 */
export function moneyFormat(
	locale: string,
	notation: "standard" | "compact" = "standard",
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		...(notation === "compact"
			? { notation: "compact", maximumSignificantDigits: 3 }
			: { maximumFractionDigits: 0 }),
	});
}

/** A count of days in words: "30 days", "1 day". Period labels and stage ages use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/** The first letters of the first and the last word of a name, for an avatar: "Amara Lindqvist" gives "AL". */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/**
 * Puts values into a message: fillMessage("{count} deals", { count: "4" }) gives "4 deals".
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
