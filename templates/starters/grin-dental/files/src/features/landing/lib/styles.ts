// Class strings that several sections of the home page share: the page measure, the tags, the titles, the buttons.
// The section components join them with cn(). The sticker recipes they name live in landing.css.

/** The page measure: at most 1200px, 4% of air on each side, 16px at least on a phone. */
export const WRAP = "mx-auto w-[min(1200px,92%)]";

/** The display face at its heavy weight, for every title, button, and pill. */
export const DISPLAY = "font-display font-extrabold tracking-[-0.01em]";

/** A tilted pill label in capitals above a section title. Add a fill such as bg-(--gd-sun) and a rotate class. */
export const TAG =
	"gd-outline-thin gd-shadow-3 inline-block rounded-full px-[1.05em] py-[0.42em] font-bold font-display text-[0.8rem] uppercase leading-snug tracking-[0.09em]";

/** A section title: the display face from 34px to 63px, tight lines, balanced rag. */
export const SECTION_TITLE = `${DISPLAY} text-balance text-[clamp(2.15rem,4.6vw,3.95rem)] leading-[1.02]`;

/** The lede under a section title: bold body text in the soft ink. */
export const SECTION_LEDE =
	"max-w-[62ch] font-bold text-[1.12rem] text-foreground/72 leading-relaxed";

/** The coral pill button. Add gd-btn-white or gd-btn-sun for the other fills. */
export const BUTTON = `gd-btn ${DISPLAY} px-[1.7em] py-[0.85em] text-[1.05rem] leading-none`;

/** The big variant of BUTTON, for the main action of a section. */
export const BUTTON_BIG = `gd-btn ${DISPLAY} px-[2.1em] py-[1em] text-[clamp(1.1rem,1.6vw,1.25rem)] leading-none`;

/** A small pill with a hard shadow: price pills, name pills, the stamps. Add a fill. */
export const PILL =
	"gd-outline-thin gd-shadow-3 inline-block rounded-full px-[0.95em] py-[0.35em] font-display font-extrabold text-[0.9rem] leading-snug";
