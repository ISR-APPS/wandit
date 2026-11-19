// Small text helpers of the social pages: day counts, shares, count forms, and message templates.
// The cards of every feature call them. They use only Intl and string methods.

/** A count of days in words: "30 days", "1 day". The period controls use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/** A share as a percent with no decimal: 0.418 gives "42%". Share bars and ranked lists use it. */
export function shareFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
}

/** An engagement rate with one decimal: 0.0483 gives "4.8%". Every engagement rate of the app uses it. */
export function rateFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
}

/**
 * Picks the form of a count message: "one" for a singular count, else "other".
 * Intl.PluralRules holds the rule of the language. In English, only 1 is "one".
 */
export function countForm(locale: string, count: number): "one" | "other" {
	return new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
}

/**
 * Puts values into a message: fillMessage("{count} posts", { count: "4" }) gives "4 posts".
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
