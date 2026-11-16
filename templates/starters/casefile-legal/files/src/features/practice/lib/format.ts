// Small text and number helpers of the practice pages: money, hours, day counts, initials, and message templates.
// The pages and cards of every feature call them. They use only Intl and string methods.

/** ISO 4217 code of every amount in the sample tables. A later database gives the currency of the firm. */
export const CURRENCY = "USD";

/** A money format with no cents: every rate is a multiple of 10 and every entry a multiple of 0.1 hour. */
export function moneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		maximumFractionDigits: 0,
	});
}

/**
 * Rounds hours to one decimal, the unit of the firm.
 * Sums of tenths drift in binary floats (0.1 + 0.2 gives 0.30000000000000004), so every hour sum goes through it.
 */
export function toTenths(hours: number): number {
	return Math.round(hours * 10) / 10;
}

/** Hours with one decimal, as a firm bills them in tenths: "1.5", "12.0". */
export function hoursFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
}

/** A count of days in words: "30 days", "1 day". Period labels use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/** The first letters of the first and the last word of a name, for an avatar: "Helena Okafor" gives "HO". */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/);
	const first = Array.from(words[0] ?? "")[0] ?? "";
	const last =
		words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";
	return `${first}${last}`.toLocaleUpperCase();
}

/**
 * Puts values into a message: fillMessage("{count} matters", { count: "4" }) gives "4 matters".
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
