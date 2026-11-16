// Class strings that several sections share: the page container, the small labels, the titles, and the buttons.
// The section components read them. The colors are theme tokens and the mustard variable of landing.css.
// In cn(), a font size class removes a line height class before it. So put the line height after the size.
import { cn } from "~/shared/lib/utils";

/** Page container: 1320px at most, with the side gutter of landing.css. */
export const WRAP = "mx-auto w-full max-w-[1320px] px-(--sc-gut)";

/** Eyebrows and field labels: 11px capitals in the body face. */
export const LABEL_TEXT = "font-bold text-[11px] uppercase tracking-[0.13em]";

/** The display face for titles, names, and numerals. The face has one true weight for this use: 400. */
export const DISPLAY_TEXT =
	"font-display font-normal uppercase tracking-[0.005em]";

/** Line height of a two-line section title. Put it after the font size class. */
export const TITLE_LEADING = "leading-[0.88]";

/** Head of a price list: a display line over a 3px ink rule. */
export const LIST_HEAD = cn(
	DISPLAY_TEXT,
	"border-foreground border-b-[3px] pb-2 text-[clamp(1.1rem,1.6vw,1.35rem)] leading-none tracking-[0.04em]",
);

/** Small print under a list: provenance, supplements, one honest limit. */
export const LIST_NOTE =
	"border-foreground/22 border-t pt-3 text-[0.86rem] text-foreground/72 leading-[1.45]";

/** On hover and focus the element slides 3px along the reading direction, as sauce runs. BUTTON and the phone plate use it. */
export const SLIDE_ON_HOVER =
	"transition-[translate,background-color,color] duration-150 hover:translate-x-[3px] focus-visible:translate-x-[3px] motion-reduce:transition-none rtl:hover:-translate-x-[3px] rtl:focus-visible:-translate-x-[3px]";

/** Flat button, 48px high, with the slide of SLIDE_ON_HOVER. */
export const BUTTON = cn(
	"inline-flex min-h-12 items-center gap-2 px-5.5 font-bold text-sm uppercase tracking-[0.07em]",
	SLIDE_ON_HOVER,
);

/** The main action on the cream ground. */
export const BUTTON_HOT =
	"bg-primary text-primary-foreground hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background";

/** The main action on the hot ground. */
export const BUTTON_MUSTARD =
	"bg-(--sc-mustard) text-foreground hover:bg-background focus-visible:bg-background";

/** Under 640px an action row stacks its buttons. Each one takes the full width and centers its text. */
export const PHONE_FULL_WIDTH =
	"w-full justify-center sm:w-auto sm:justify-start";

/** The second action: text over a 3px accent underline. The caller sets the underline color. */
export const BUTTON_GHOST =
	"border-b-[3px] hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background";
