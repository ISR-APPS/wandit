// Small text helpers of the tracker pages: initials, message templates, and count formats.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** The first letters of the first and the last word of a name, for an avatar: "Mei Lindgren" gives "ML". */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/**
 * Puts values into a message: fillMessage("{count} tasks", { count: "4" }) gives "4 tasks".
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

/**
 * The plural form of `count` in the app language, for a message group with "one" and "other" keys.
 * English needs only these two forms. A language with more forms maps the rest to "other".
 */
export function pluralOf(count: number, locale: string): "one" | "other" {
	return new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
}

/** A count of days in words: "30 days", "1 day". Period labels and cycle times use it. */
export function dayCountFormat(
	locale: string,
	maximumFractionDigits = 0,
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
		maximumFractionDigits,
	});
}
