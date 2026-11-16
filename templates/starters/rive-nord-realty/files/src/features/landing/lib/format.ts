// Number formats of the board: prices in euros and plain counts.
// The rows, the window, the district sheet, and the numbers section call them with the locale of useT().
// Intl gives the same text on the server and in the browser, so the prerendered page does not change at hydration.
import type { Locale } from "~/shared/i18n";

/** A whole-euro price, for example "€412,000". The board never prints cents. */
export function formatEuros(value: number, locale: Locale): string {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	}).format(value);
}

/** A count with the thousands separator of the locale, for example "1,340". */
export function formatCount(value: number, locale: Locale): string {
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
		value,
	);
}
