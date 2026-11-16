// Class strings that several sections of the product page share: the container, the labels, and the titles.
// The section components import them, so one change here reaches every section.
// landing.css holds the classes with the "lume-" prefix.

/** The page container: 90rem at most, with the side padding of landing.css. */
export const WRAP = "mx-auto w-full max-w-[90rem] px-(--lume-pad)";

/** The vertical padding of a chapter. The middle term is vh, so the rhythm follows the screen height. */
export const CHAPTER = "py-[clamp(5rem,11vh,8.5rem)]";

/** A section kicker: brass capitals with a 2.4rem rule before them. Deep brass keeps 4.5:1 on the paper. */
export const KICKER =
	"lume-ruled flex items-center gap-[0.9em] font-medium text-(--lume-brass-deep) text-[0.75rem] uppercase tracking-[0.22em]";

/** A section title: the grotesk at 500. SectionHead puts the second clause in a .lume-turn span. */
export const SECTION_TITLE =
	"max-w-[16em] font-display font-medium text-[clamp(2.3rem,5vw,4.2rem)] leading-[1.04] tracking-[-0.01em]";

/** A label over a value: small capitals in the ink at 52%. */
export const MICRO =
	"font-medium text-[0.74rem] text-foreground/52 uppercase tracking-[0.16em]";

/** A figure caption row under a framed photo: text at the start, the figure number at the end. Add a text color at the call. */
export const FIG_CAPTION =
	"mt-[0.9rem] flex justify-between gap-4 text-[0.78rem] tracking-[0.06em]";
