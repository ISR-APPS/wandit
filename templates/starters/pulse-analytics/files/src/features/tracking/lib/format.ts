// Small text helpers of the analytics pages: day counts, initials, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** A count of days in words: "30 days", "1 day". The period controls use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/** A share as a percent with no decimal: 0.418 gives "42%". Bars and adoption lists use it. */
export function shareFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
}

/** The first letters of the first two words of a name, for a mark: "Harborline Freight" gives "HF". */
export function initialsOf(name: string): string {
	const words = name.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "");
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const second = Array.from(words[1] ?? "")[0] ?? "";
	return `${first}${second}`.toLocaleUpperCase();
}

/**
 * Puts values into a message: fillMessage("{count} people", { count: "4" }) gives "4 people".
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
