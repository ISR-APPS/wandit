// Class strings that several sections of the home page share: the container, the mono registers, the titles, and the buttons.
// The section components import them, so one change here reaches every section.
// landing.css holds the classes with the "nour-" prefix.

/** The page container: 1400px at most, with the side gutter of landing.css. */
export const WRAP = "mx-auto w-full max-w-[1400px] px-(--nour-gutter)";

/** A band: one section with a hairline over it. The anchor stops under the sticky header. */
export const BAND =
	"scroll-mt-[72px] border-foreground/16 border-t py-(--nour-band)";

/** The mono register of labels, captions, and table cells: 11px capitals in the grey of the theme. */
export const MONO =
	"nour-mono text-[11px] text-muted-foreground uppercase leading-[1.5] tracking-[0.05em]";

/** A section kicker: the mono register with wide tracking, for example "02 — Inventory". */
export const KICKER =
	"nour-mono text-[11px] text-muted-foreground uppercase leading-[1.5] tracking-[0.14em]";

/** The small label over a value in a ledger cell: 10px mono capitals. */
export const LEDGER_LABEL =
	"nour-mono text-[10px] text-muted-foreground uppercase leading-[1.5] tracking-[0.13em]";

/** A section title: the grotesk at weight 500, with tight tracking. Add a max width at the call. */
export const TITLE =
	"font-display font-medium text-[clamp(1.8rem,3.7vw,3.1rem)] leading-[1.02] tracking-[-0.032em]";

/** A note under a title: 14.5px in the grey of the theme. */
export const NOTE =
	"text-[14.5px] text-muted-foreground leading-[1.6] tracking-normal";

/** The 5px square before a stock line. Add bg-primary for a piece in stock, bg-muted-foreground for a sold-out one. */
export const DOT = "me-[5px] mb-px inline-block size-[5px] align-middle";

const BUTTON =
	"nour-mono inline-flex min-h-11 items-center justify-center border px-5 text-[11px] uppercase tracking-[0.11em] transition-colors duration-300";

/** The main action: an ink fill that turns to an outline on hover and on focus. */
export const BUTTON_FILL = `${BUTTON} border-foreground bg-foreground text-background hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground`;

/** The second action: a hairline box that fills with ink on hover and on focus. */
export const BUTTON_GHOST = `${BUTTON} border-foreground/16 text-foreground hover:border-foreground hover:bg-foreground hover:text-background focus-visible:border-foreground focus-visible:bg-foreground focus-visible:text-background`;

/** A text link of a contact line: a 44px touch box, with a hairline under the words on hover and on focus. */
export const CONTACT_LINK =
	"inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:underline";
