// Class strings that many sections of the board share: labels, display capitals, the gutter.
// The section components join them with cn(). The fonts come from the theme: Anton for display, Archivo for text.

/** Small bold capitals with wide tracking: the labels of the printed board. */
export const LABEL =
	"font-sans font-bold text-[11px] uppercase leading-[1.4] tracking-[0.18em]";

/**
 * The display face in capitals. Anton has one weight, so the class sets 400 and the browser draws no false bold.
 * No line height here: cn() drops a leading class before a later text size, so each use sets its leading after the size.
 */
export const DISPLAY = "font-display font-normal uppercase tracking-[0.005em]";

/** The side gutter of every band: 16px on a phone, up to 56px on a wide screen. */
export const WRAP = "px-(--rn-pad)";

/** Figures in columns, so prices and counts line up. */
export const FIGURES = "tabular-nums";
