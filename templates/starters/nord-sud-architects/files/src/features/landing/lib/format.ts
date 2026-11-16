// Number formats of the drawings: dimensions in metres, areas, levels, and millimetres.
// The figure components call them with the locale of useT(), so a French page writes 12,40.
// A non-breaking space joins each value to its unit, as a drawing set does.
import type { Locale } from "~/shared/i18n";

// 96 CSS pixels make one inch, and one inch is 25.4 mm.
const MM_PER_CSS_PIXEL = 25.4 / 96;

/** A dimension in metres with two decimals and no unit, as on a dimension line: 12.40. */
export function formatMetres(locale: Locale, metres: number) {
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(metres);
}

/** A level mark: a sign, then the height in metres: +3.40. The ground level is +0.00. */
export function formatLevel(locale: Locale, metres: number) {
	return `+${formatMetres(locale, metres)}`;
}

/** A floor area with one decimal and the unit: 56.2 m². */
export function formatArea(locale: Locale, squareMetres: number) {
	const value = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(squareMetres);
	return `${value} m²`;
}

/** A whole area for a project fact: 1,850 m². */
export function formatWholeArea(locale: Locale, squareMetres: number) {
	return `${new Intl.NumberFormat(locale).format(squareMetres)} m²`;
}

/** The true screen length of a width in CSS pixels, in millimetres with one decimal: 137.6 mm. */
export function formatScreenMillimetres(locale: Locale, cssPixels: number) {
	const value = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(cssPixels * MM_PER_CSS_PIXEL);
	return `${value} mm`;
}
