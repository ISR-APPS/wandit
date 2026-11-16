// Number and text helpers of the box office: money, names, and the time of day.
// The pages of every feature format with these, so one amount reads the same on each page.
// The currency is a setting of the organiser. A later turn moves it to a settings table.

/** The currency of every price and amount of the sample data. */
export const BOX_OFFICE_CURRENCY = "EUR";

/** A money format in the app language. Amounts of the sample are whole euros, so no cents show. */
export function moneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: BOX_OFFICE_CURRENCY,
		maximumFractionDigits: 0,
	});
}

/** The time of day, for example "8:30 PM" in English. */
export function timeFormat(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, { timeStyle: "short" });
}

/** The two initials of a full name, for an avatar. */
export function initialsOf(fullName: string): string {
	return fullName
		.split(" ")
		.filter((part) => part.length > 0)
		.slice(0, 2)
		.map((part) => Array.from(part)[0] ?? "")
		.join("")
		.toLocaleUpperCase();
}

/**
 * Puts values into a message, for example "{sold} of {capacity} sold".
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
 * A count with its noun, for example "1 ticket" or "3 tickets".
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
