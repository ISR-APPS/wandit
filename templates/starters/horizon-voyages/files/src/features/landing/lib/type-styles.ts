// Class strings that several sections of the home page share: the page column, the type scale, and the meta capitals.
// It also holds CssVariableStyle, the style type for inline CSS variables.
// The section components of this feature import them. The values come from the HORIZON world: a low-contrast serif, tracked slate capitals.
// The --hz-* variables are in landing.css, on the .hz-scope class.
import type { CSSProperties } from "react";

/** A style object that also carries CSS custom properties. React passes them through as they are. LockedPhoto and the season cells use it. */
export type CssVariableStyle = CSSProperties & Record<`--${string}`, string>;

/** The page column: 1240px at most, with the side gutter of the page (20px to 64px). */
export const WRAP = "mx-auto w-full max-w-[1240px] px-(--hz-gutter)";

/** The vertical padding of a plain section: 5rem on a phone, 8.5rem on a tall screen. */
export const SECTION = "py-[clamp(5rem,9.5vh,8.5rem)]";

/** Tracked capitals at 11px. Every one labels a real thing: a section, a chip, a table head. */
export const META =
	"font-semibold text-(--hz-ink-soft) text-[11px] uppercase leading-[1.5] tracking-[0.15em]";

/** The smaller capitals at 10.5px: captions, fact rows, row labels. */
export const META_SMALL =
	"font-semibold text-(--hz-ink-soft) text-[10.5px] uppercase leading-[1.5] tracking-[0.16em]";

/** The page title. Ovo has one weight, so every display class sets font-normal. */
export const H1 =
	"font-display font-normal text-[clamp(2.55rem,5.4vw,4.9rem)] leading-[1.045] tracking-[-0.012em]";

/** A section title: one or two lines. */
export const H2 =
	"font-display font-normal text-[clamp(1.85rem,3.4vw,3rem)] leading-[1.12] tracking-[-0.012em]";

/** The name of a circuit or of a step. */
export const H3 =
	"font-display font-normal text-[clamp(1.5rem,2.1vw,1.95rem)] leading-[1.15] tracking-[-0.01em]";

/** The first paragraph under the page title: 56 characters wide at most. */
export const LEAD =
	"max-w-[56ch] text-pretty text-[clamp(1.02rem,1.2vw,1.16rem)] text-(--hz-ink-body) leading-[1.62]";

/** Running text: 58 characters wide at most. */
export const BODY =
	"max-w-[58ch] text-pretty text-[15px] text-(--hz-ink-body) leading-[1.62]";

/** A caption on the ground under a photo: an em dash, the place, and one true fact. */
export const CAPTION = `${META_SMALL} block pt-[11px]`;

/** A value in a hairline row, a price, or a temperature: the display face, never bold. */
export const FIGURE = "font-display font-normal leading-[1.1]";

/** The currency word after a price: the body face at 0.6em, tracked. */
export const CURRENCY =
	"ms-1 font-sans font-semibold text-(--hz-ink-soft) text-[0.6em] tracking-[0.12em]";
