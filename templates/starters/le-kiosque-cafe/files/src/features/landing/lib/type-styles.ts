// The class strings that the sections of the Le Kiosque page share: furniture, headlines, decks, captions, buttons.
// Each section component reads them. Sizes follow the type scale of the gazette world.
// font-display is the masthead face, font-sans the caption face, and ks-serif (kiosque.css) the prose face.

/** Caps furniture in the caption face: labels, bylines, nav. Add the size and the color at the call site. */
export const FURNITURE = "font-sans font-semibold uppercase tracking-[0.1em]";

/** The brick kicker above a lead headline. One per screen at most. */
export const KICKER =
	"font-bold font-sans text-[0.8rem] text-primary uppercase tracking-[0.14em]";

/** A lead headline: the masthead face 800 at 30 to 58px. */
export const HEADLINE =
	"text-balance font-display font-extrabold text-[clamp(1.9rem,4.6vw,3.6rem)] leading-[1.04] tracking-[-0.005em]";

/** The italic line under a headline, in the prose face. */
export const DECK =
	"ks-serif text-pretty text-[clamp(1.05rem,1.6vw,1.25rem)] text-foreground/82 italic leading-[1.45]";

/** The byline under a deck. */
export const BYLINE =
	"font-sans font-semibold text-[0.72rem] text-foreground/72 uppercase tracking-[0.12em]";

/** A jump line that cites a page of the rubric nav. It sits at the end side of its block. */
export const JUMP =
	"inline-flex min-h-11 items-center font-bold font-sans text-[0.74rem] text-primary uppercase tracking-[0.11em] underline-offset-4 hover:underline focus-visible:underline";

/** The bold caps run-in that opens every lede ("Lyon, 2nd arr. —"). No drop caps exist on the page. */
export const DATELINE = "font-bold text-[0.92em] uppercase tracking-[0.02em]";

/** The caption under a plate, in the caption face, after a hairline. */
export const CAPTION =
	"mt-3 border-foreground/25 border-t pt-2 font-sans text-[0.8rem] text-foreground/75 leading-[1.45]";

/** A link inside prose: ink underlined, brick on hover and focus. */
export const PROSE_LINK =
	"underline decoration-1 underline-offset-2 transition-colors duration-200 hover:text-primary focus-visible:text-primary";

/** The base of every button: square, caps, 44px high at least. */
export const BUTTON =
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-none border-2 px-6 py-3 font-bold font-sans text-[0.8rem] uppercase leading-none tracking-[0.11em] transition-colors duration-250";

/** The one brick button of the page: the call to write to the paper. */
export const BUTTON_BRICK =
	"border-primary bg-primary text-primary-foreground hover:border-(--ks-brick-deep) hover:bg-(--ks-brick-deep) focus-visible:border-(--ks-brick-deep) focus-visible:bg-(--ks-brick-deep)";

/** The ink outline button: it fills with ink on hover and focus. */
export const BUTTON_INK =
	"border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background";
