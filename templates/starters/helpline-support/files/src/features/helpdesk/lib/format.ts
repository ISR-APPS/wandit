// Small text helpers of the desk pages: the money format, initials, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** ISO 4217 code of every amount in the sample customers. A later database gives the currency of the business. */
export const CURRENCY = "USD";

/** A money format with no cents, for the monthly revenue of a customer. */
export function moneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		maximumFractionDigits: 0,
	});
}

/** The first letters of the first and the last word of a name, for an avatar: "Ines Moreau" gives "IM". */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/**
 * Puts values into a message: fillMessage("{count} open", { count: "4" }) gives "4 open".
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
