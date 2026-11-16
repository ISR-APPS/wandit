// Class strings that more than one section of the Capitale Conseil page uses.
// The section components join them with their own layout classes.
// landing.css sets the custom properties (--cap-bar, --cap-steel, --cap-band-soft) on .cap-scope.
// The page has two own breakpoints, in rem so that Tailwind sorts them: 56.25rem is 900px, 73.75rem is 1180px.

/** The small-caps label face: 11px, then 12px from 900px. The color comes from the caller. */
export const LABEL =
	"font-sans font-semibold text-[0.6875rem] uppercase leading-[1.3] tracking-[0.14em] min-[56.25rem]:text-xs";

/** The term of a fact ledger: 10px navy caps over its value. The case study and the quote use it. */
export const TERM =
	"font-semibold text-[0.625rem] text-primary uppercase leading-[1.4] tracking-[0.14em]";

/** The micro caps of a meta cell: 10.5px. It names a figure, a date, or a column. */
export const MICRO =
	"font-sans font-semibold text-[0.65625rem] uppercase leading-[1.4] tracking-[0.13em]";

/** One numbered movement of the page. The anchor stops 8px below the sticky header. */
export const MOVEMENT =
	"scroll-mt-[calc(var(--cap-bar)+8px)] py-[clamp(4rem,9vh,7.5rem)]";

/** The section title: the serif face at the regular weight. A bold serif title reads as a newspaper. */
export const SECTION_TITLE =
	"text-balance font-display font-normal text-[clamp(1.9rem,3.4vw,3.1rem)] leading-[1.1] tracking-[-0.015em]";

/** The title of a ledger row or of a person. */
export const ROW_TITLE =
	"font-display font-normal text-[clamp(1.35rem,2.2vw,1.85rem)] leading-[1.16] tracking-[-0.015em]";

/** Secondary text: the ink at 65%. It keeps a contrast above 4.5:1 on the paper and on the steel ground. */
export const SOFT = "text-foreground/65";

// The two buttons share the box: square, 14px, and at least 48px tall for a thumb.
const BUTTON_BOX =
	"inline-flex min-h-12 items-center justify-center border px-[1.7rem] py-[0.95rem] text-center font-sans font-semibold text-sm leading-[1.5] tracking-[0.06em] transition-[background-color,border-color,color,text-indent] duration-[180ms] ease-linear";

/** The filled action. On hover it takes the ink, and its text moves 1px to the end. */
export const BUTTON_PRIMARY = `${BUTTON_BOX} border-primary bg-primary text-primary-foreground hover:border-foreground hover:bg-foreground hover:indent-px focus-visible:border-foreground focus-visible:bg-foreground`;

/** The quiet action: a hairline that takes the full ink on hover. */
export const BUTTON_GHOST = `${BUTTON_BOX} border-foreground/30 text-foreground hover:border-foreground hover:text-primary focus-visible:border-foreground`;
