// Class strings that every section of the home page shares: the page wrap, the band rhythm, and the type roles.
// The section components read them. The colors come from the tokens and from landing.css.

/** The page column: 80rem wide with a fluid gutter of 20px to 56px. `.cn-bleed` in landing.css reads the same values. */
export const WRAP = "mx-auto w-full max-w-[80rem] px-[clamp(20px,4vw,56px)]";

/** The vertical rhythm of a full section band, 58px on a phone to 112px on a wide screen. */
export const BAND = "py-[clamp(58px,8vw,112px)]";

/** The small caps label above a heading. */
export const EYEBROW =
	"block font-semibold text-[0.6875rem] text-muted-foreground uppercase leading-none tracking-[0.15em]";

/** The section heading: display face, bold, at most 20 characters a line. */
export const H2 =
	"max-w-[20ch] text-balance font-bold font-display text-[clamp(1.85rem,3.4vw,3rem)] leading-[1.06] tracking-[-0.022em]";

/** The lede next to a section heading: 56 characters a line at most. */
export const LEDE =
	"max-w-[56ch] text-[clamp(1.02rem,1.15vw,1.14rem)] text-(--cn-ink-2) leading-[1.62]";

/** A pill chip. Add a ground class, for example `bg-(--cn-pale)`. */
export const CHIP =
	"inline-flex items-center gap-2 whitespace-nowrap rounded-full px-[15px] py-[7px] font-semibold text-[0.75rem] leading-tight tracking-[0.02em]";

/** The caps variant of the chip: captions under photos, timetable legend. */
export const CHIP_CAPS =
	"inline-flex items-center whitespace-nowrap rounded-full px-[13px] py-[7px] font-semibold text-[0.6875rem] uppercase leading-tight tracking-[0.13em]";

/** The pill button. Add `cn-btn` (sky) or `cn-btn-sand` from landing.css. */
export const BUTTON =
	"inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full px-6 py-3.5 font-semibold text-[0.9375rem] leading-none";

/** A photo caption on a pale sky pill. One fact per chip, two chips per photo at most. */
export const CAPTION_FILLED = `${CHIP_CAPS} bg-(--cn-pale) text-foreground`;

/** The second caption of a photo: a hairline pill. */
export const CAPTION_LINE = `${CHIP_CAPS} border border-input text-(--cn-ink-2)`;
