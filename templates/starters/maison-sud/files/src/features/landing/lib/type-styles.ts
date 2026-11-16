// Class strings of the landing page: labels, titles, names, prose, the two actions, and the photo frame.
// The section components of this feature import them, so one register has one definition.
// Sizes follow the measured scale of the Maison world. Colors and faces come from the theme tokens.

/** Page container: 1240px wide at most, with the side padding of landing.css. */
export const WRAP = "mx-auto w-full max-w-[1240px] px-(--ms-pad)";

/** One column on a phone, twelve columns from 768px. The gap comes from landing.css. */
export const GRID = "grid grid-cols-1 gap-(--ms-gap) md:grid-cols-12";

/** Micro-cap label, 10.5px. It sits in a plinth or on a rule, never on bare ground. */
export const MICRO_CAPS =
	"font-medium text-[10.5px] text-muted-foreground uppercase leading-normal tracking-[0.18em]";

/** The tighter register: material numbers, itinerary ticks, fact keys, and table heads. 9.5px from 768px, 10.5px on a phone. */
export const MICRO_CAPS_TIGHT =
	"font-medium text-[10.5px] text-muted-foreground uppercase leading-normal tracking-[0.19em] md:text-[9.5px]";

/** A micro-cap label that hangs on a rule at 18% ink. It opens a section or a panel. */
export const RULE_LABEL = `block border-foreground/18 border-t pt-[0.8rem] ${MICRO_CAPS}`;

/** Section title in the display face, set large and at the regular weight. */
export const SECTION_TITLE =
	"text-balance font-display font-normal text-[clamp(1.85rem,3.5vw,3rem)] leading-[1.12] tracking-[-0.018em]";

/** Serif name of a project, a room, or a step. `ms-serif` of landing.css gives the face. */
export const SERIF_NAME =
	"ms-serif font-normal text-[clamp(1.3rem,2.1vw,1.9rem)] leading-[1.2]";

/** Running text at 70% ink, 62 characters wide at most. */
export const PROSE =
	"max-w-[62ch] text-[1.03rem] text-foreground/70 leading-[1.72]";

/** Large numeral in stone: project numbers and step numbers. */
export const NUMERAL = "font-display text-primary tracking-[-0.03em]";

/** The cool grade of the world. Every photo of the page takes it, so no photo looks warmer than another. */
export const PHOTO_GRADE = "brightness-[1.02] saturate-[0.9]";

/** The frame of a photo: a 1px line at 10% ink, and a matte ground that shows while the file loads. */
export const PHOTO_FRAME =
	"relative ms-frame overflow-hidden border border-foreground/10 bg-secondary";

/**
 * A text link under a hairline. The inner span takes `ms-warm-line` of landing.css.
 * The padding makes the box 47px high for a finger. The negative margin keeps the layout of a text line.
 */
export const TEXT_LINK =
	"ms-warm-hover -my-3 inline-block py-3 text-[0.94rem] text-foreground/70";

/** The one ink action of a view: a square button with micro-cap text. */
export const INK_BUTTON =
	"inline-block bg-foreground px-[1.7rem] py-[1.02rem] font-medium text-[11px] text-background uppercase tracking-[0.16em] transition-colors duration-300 hover:bg-foreground/85";
