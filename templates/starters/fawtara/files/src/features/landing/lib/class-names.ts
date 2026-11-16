// Class strings that several sections of the landing page share: the container, the titles, and the texts.
// The section components import them, so one register has one definition.
// Colors and faces come from the theme tokens. landing.css gives --fw-pad and --fw-rhythm.

/** Page container: 1160px of content at most, with the side padding of landing.css. */
export const WRAP =
	"mx-auto w-full max-w-[calc(1160px+2*var(--fw-pad))] px-(--fw-pad)";

/** The vertical padding of a full section. */
export const SECTION_SPACE = "py-(--fw-rhythm)";

/** Section title: the display face at weight 800, from 30px on a phone to 48px. */
export const SECTION_TITLE =
	"text-balance font-display font-extrabold text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.12] tracking-[-0.02em]";

/** Title of a panel, a card, or a column: the display face at weight 800. */
export const BLOCK_TITLE =
	"font-display font-extrabold text-[clamp(1.4rem,2.4vw,1.9rem)] leading-tight tracking-[-0.02em]";

/** Running text in the secondary ink. */
export const LEAD = "text-[1.0625rem] text-muted-foreground leading-[1.65]";

/** A status chip of a drawn product card: 11.5px, weight 700, a full pill. */
export const CHIP =
	"inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-bold font-display text-[0.72rem] leading-normal tracking-[0.02em]";

/** A honest constraint under a decision point, at 13px. */
export const TRUST_LINE = "font-medium text-[0.82rem] text-muted-foreground";
