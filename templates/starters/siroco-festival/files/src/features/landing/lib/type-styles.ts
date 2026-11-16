// Shared class strings of the poster page: the gutter, the container, the sheet padding, the label, the sub-display, and the buttons.
// The section components read them. Colors come from the sheet class of landing.css, so these strings hold no color.
import type { Ground } from "./content";

/** Side gutter of the world chassis: 20px on a phone, 64px from 1600px. Every full-bleed row uses it. */
export const GUTTER = "px-[clamp(1.25rem,4vw,4rem)]";

/** Content column: 1360px at most, with the side gutter. */
export const WRAP = `mx-auto w-full max-w-340 ${GUTTER}`;

/** Vertical padding of a full sheet. */
export const SHEET_PAD = "py-[clamp(4.5rem,10vh,8rem)]";

/** Small caps label with its 56px rule stub. It takes the text ink of its sheet. */
export const LABEL =
	"flex items-center gap-3.5 font-bold font-sans text-[0.84rem] uppercase leading-tight tracking-[0.08em] before:h-0.5 before:w-14 before:shrink-0 before:bg-current before:content-['']";

/** Sub-display title. At 390px it stays above 9vw, as the world asks. */
export const SUB_DISPLAY =
	"text-balance font-display text-[clamp(2.4rem,6vw,5.6rem)] uppercase leading-[0.95] tracking-[0.01em]";

/** Flat button. landing.css gives the fill and the hover swap of each sheet. 48px tall at least. */
export const BUTTON =
	"sf-btn inline-flex min-h-12 items-center justify-center px-[2.2em] py-[1.05em] text-center font-bold font-sans text-[0.9rem] uppercase leading-tight tracking-[0.05em]";

/** Text link with the 2px rule. landing.css gives the hover fill. */
export const LINK = "sf-link font-semibold";

/** The sheet class of each ground. Each class sets the ground, the text ink, and the hover inks. */
export const SHEET: Record<Ground, string> = {
	cream: "sf-cream",
	cobalt: "sf-cobalt",
	vermilion: "sf-vermilion",
	mustard: "sf-mustard",
};
