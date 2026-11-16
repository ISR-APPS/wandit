// Class strings that several sections of the home page share: the page container, the ledger type, and the titles.
// The section components import them, so one change here reaches every section.
// landing.css holds the classes with the "sable-" prefix.

/** The page container: 1560px at most, with the side gutter of landing.css. */
export const WRAP = "mx-auto w-full max-w-[1560px] px-(--sable-gutter)";

/** Vertical padding of a section. The case study uses a tighter one. */
export const BAND = "py-(--sable-section)";

/** Ledger values: the mono face at 12.5px. Add a text color at the call. */
export const MONO = "sable-mono text-[12.5px] leading-normal tracking-[0.02em]";

/** Ledger headers and captions: the mono face in capitals at 11.5px, with the ink at 55%. */
export const MONO_LABEL =
	"sable-mono text-[11.5px] leading-normal tracking-[0.08em] uppercase text-foreground/55";

/** The header of a ledger cell or row: the mono face in capitals at 11px. One step smaller than MONO_LABEL. */
export const LEDGER_LABEL =
	"sable-mono text-[11px] text-foreground/55 uppercase leading-normal tracking-[0.07em]";

/** A section title: lowercase, weight 500. The index names use the same register one step smaller. */
export const SECTION_TITLE =
	"font-display font-medium text-[clamp(1.75rem,3.2vw,2.8rem)] leading-[1.04] tracking-[-0.03em]";

/** The name of a project in a row: readable from the other side of the room. */
export const ROW_NAME =
	"font-display font-medium text-[clamp(1.45rem,3.1vw,2.55rem)] leading-[1.05] tracking-[-0.025em]";

/** Body text of a section: the ink at 80% on a measure of about 60 characters. */
export const PROSE = "text-[16.5px] text-foreground/80 leading-[1.62]";

/** A text link with a hairline under it, in a 44px touch box. The hover and the focus turn both to the accent. */
export const RULED_LINK =
	"group inline-flex min-h-11 items-center text-foreground transition-colors duration-150 hover:text-primary focus-visible:text-primary";

/** The inner text of a RULED_LINK: it carries the hairline, so the line sits close under the words. */
export const RULED_LINK_TEXT =
	"border-foreground/24 border-b pb-[3px] transition-colors duration-150 group-hover:border-primary group-focus-visible:border-primary";

/** The 7px square: the only bullet of the page. The call adds the fill: bg-primary, or bg-background on the ink footer. */
export const SQUARE = "block size-[7px] flex-none";

/** The wordmark as a section mark: it heads a column, directly over the ledger or the title of that column. */
export const SECTION_MARK =
	"sable-fade block pb-3.5 font-display font-medium text-[clamp(22px,2.1vw,28px)] leading-none tracking-[-0.03em]";
