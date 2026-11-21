// Small text helpers of the dispatch pages: weight and day formats, initials, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** A weight in kilograms with its unit: "1,840 kg". The sample rows store whole kilograms. */
export function weightFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "kilogram",
		maximumFractionDigits: 0,
	});
}

/** A distance in kilometers with its unit: "86 km". Odometers and lanes use it. */
export function distanceFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "kilometer",
		maximumFractionDigits: 0,
	});
}

/** A count of days in words: "30 days", "1 day". Period labels and late marks use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/** A share from 0 to 1 as a percent with at most one decimal: "89.4%". */
export function percentFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
}

/** The first letters of the first and the last word of a name, for an avatar: "Aisha Bello" gives "AB". */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/** The tel: link of a phone number, for example "555-0142". A tel: link keeps dashes but drops spaces. */
export function telHref(phone: string): string {
	return `tel:${phone.replaceAll(" ", "")}`;
}

/**
 * The plural form of a count in the app language: "one" for 1 in English, else "other".
 * A message with a count has one text per form, for example `load.pallets.one` and `load.pallets.other`.
 */
export function pluralForm(count: number, locale: string): "one" | "other" {
	return new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
}

/** `text` with a capital first letter. Intl writes relative days in lower case: "today" becomes "Today" in a table cell. */
export function capitalize(text: string, locale: string): string {
	const [first = "", ...rest] = Array.from(text);
	return `${first.toLocaleUpperCase(locale)}${rest.join("")}`;
}

/**
 * Puts values into a message: fillMessage("{open} open", { open: "37" }) gives "37 open".
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
