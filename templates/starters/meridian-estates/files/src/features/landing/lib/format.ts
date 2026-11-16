// Number formats of the home page: guide prices, areas, and the figures of the measured band.
// PropertyPanel, ResidenceSection, and NumbersSection call them with the page language, so a second language formats its own way.
import type { Locale } from "~/shared/i18n";

/** A guide price in millions of US dollars as a short figure, for example 8.4 -> "$8.4M". */
export function formatGuidePrice(millions: number, locale: Locale): string {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(millions * 1_000_000);
}

/** A whole number with the group separator of the language, for example 96400 -> "96,400". */
export function formatWhole(value: number, locale: Locale): string {
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
		value,
	);
}
