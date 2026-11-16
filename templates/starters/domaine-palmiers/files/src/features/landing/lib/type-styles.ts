// Class strings that several sections of the home page share: the page column, the type scale, and the two actions.
// The section components of this feature import them. The values come from the DOMAINE world: a serif display, small bronze capitals, square ink buttons.
// The --dlp-* variables are in landing.css, on the .dlp-scope class.

/** The page column: 1280px at most, with the side padding of the page. */
export const WRAP = "mx-auto w-full max-w-[1280px] px-(--dlp-pad)";

/** The vertical padding of a section: 4.6rem on a phone, 8.5rem on a wide screen. */
export const SECTION = "py-(--dlp-rhythm)";

/** Small bronze capitals at 10.5px. A label always sits on a rule, in a cell, or on a plate. */
export const LABEL =
	"font-semibold text-(--dlp-bronze-deep) text-[10.5px] uppercase leading-[1.5] tracking-[0.2em]";

/** The 10px bronze key of a ledger, a rail cell, a table head, or a field. It is smaller than LABEL. */
export const KEY_LABEL =
	"font-semibold text-(--dlp-bronze-deep) text-[10px] uppercase leading-[1.5] tracking-[0.18em]";

/** A label on its rule: the hairline above carries it, so it never floats on the ground. */
export const RULE_LABEL = `${LABEL} block w-full border-foreground/24 border-t pt-[0.85rem]`;

/** The page title: three short lines, 4.7rem at most. */
export const H1 =
	"font-display font-normal text-[clamp(2.3rem,5.7vw,4.7rem)] leading-[1.05] tracking-[-0.012em]";

/** A section title: two short lines. */
export const H2 =
	"font-display font-normal text-[clamp(1.85rem,3.5vw,3.15rem)] leading-[1.1] tracking-[-0.008em]";

/** The name of a villa or of a ledger. */
export const H3 =
	"font-display font-normal text-[clamp(1.25rem,1.9vw,1.65rem)] leading-[1.2]";

/** The first paragraph beside a title: 46 characters wide at most. */
export const LEDE =
	"max-w-[46ch] text-pretty text-[clamp(1.02rem,1.15vw,1.2rem)] text-foreground/75 leading-[1.62]";

/** Running text: 60 characters wide at most. */
export const BODY =
	"max-w-[60ch] text-pretty text-[1rem] text-foreground/75 leading-[1.7]";

/** A caption under a photo or a table. It sits on a hairline that the caller adds. */
export const CAPTION =
	"text-pretty text-[0.88rem] text-muted-foreground leading-[1.6]";

/** The main action: a square ink button of 48px. It turns bronze on hover and on focus. */
export const BUTTON =
	"inline-flex min-h-12 items-center justify-center border border-foreground bg-foreground px-[1.7rem] py-[1.05rem] text-center font-semibold text-[11px] text-background uppercase leading-[1.3] tracking-[0.17em] transition-colors duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-(--dlp-bronze-deep) hover:bg-(--dlp-bronze-deep) focus-visible:border-(--dlp-bronze-deep) focus-visible:bg-(--dlp-bronze-deep)";

/** The second action: small capitals on a hairline. The touch area is 44px high. */
export const TEXT_LINK =
	"group inline-flex min-h-11 items-center font-semibold text-[10.5px] uppercase leading-none tracking-[0.16em] transition-colors duration-[350ms] hover:text-(--dlp-bronze-deep) focus-visible:text-(--dlp-bronze-deep)";

/** The hairline under the text of a TEXT_LINK. Put it on a span inside the link. */
export const TEXT_LINK_RULE =
	"border-foreground/24 border-b pb-[0.45rem] transition-colors duration-[350ms] group-hover:border-(--dlp-bronze-deep) group-focus-visible:border-(--dlp-bronze-deep)";
