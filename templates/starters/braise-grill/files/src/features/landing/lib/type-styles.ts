// The class strings that many sections of the Braise page share: labels, titles, prose, captions, and buttons.
// Each section component reads them. The values follow the type scale of the braise world.
// Colors are token classes; landing.css declares --br-ember-hot and --br-hair from the tokens.

/** Small caps label above a title. Always render it with the ember square of components/eyebrow.tsx. */
export const EYEBROW =
	"font-bold font-sans text-[clamp(10.5px,0.72vw,11.5px)] text-foreground/55 uppercase leading-normal tracking-[0.17em]";

/** Small caps label of a fact row or a table head: 11px, ink at 55%. */
export const MICRO_LABEL =
	"font-bold font-sans text-[11px] text-foreground/55 uppercase leading-normal tracking-[0.15em]";

/** A section title: display face 700 at 32 to 56px. */
export const SECTION_TITLE =
	"text-balance font-bold font-display text-[clamp(2rem,4.3vw,3.5rem)] leading-[1.02] tracking-[-0.025em]";

/** Prose of a section: ink at 72%, at most 58 characters wide. */
export const BODY_TEXT = "max-w-[58ch] text-foreground/72";

/** The lead paragraph under a section title. */
export const LEAD_TEXT =
	"max-w-[60ch] text-[clamp(16px,1.22vw,19px)] text-foreground/72 leading-[1.6]";

/** The caption under a photograph. Render it with the ember square of components/photo-caption.tsx. */
export const CAPTION =
	"mt-3 max-w-[52ch] text-[clamp(11.5px,0.8vw,12.5px)] text-foreground/55 tracking-[0.04em]";

/** A figure in the display face with tabular numerals: prices, hours, weights. */
export const FIGURE = "font-display tabular-nums";

/** The base of every button: 44px high at least, 2px corners, body face 700. */
export const BUTTON =
	"inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-[calc(var(--radius)*0.34)] border border-transparent px-6.5 py-3.5 font-bold font-sans text-[clamp(13px,0.92vw,14.5px)] leading-none tracking-[0.04em] transition-colors duration-200";

/** The filled ember button: the main booking action. The header Book button and one section button may share a screen. */
export const BUTTON_EMBER =
	"bg-primary text-primary-foreground hover:bg-(--br-ember-hot) focus-visible:bg-(--br-ember-hot) active:bg-[color-mix(in_oklab,var(--primary),var(--background)_35%)]";

/** The ghost button: a chalk hairline that turns ember on hover. */
export const BUTTON_GHOST =
	"border-foreground/22 bg-transparent text-foreground hover:border-primary hover:text-(--br-ember-hot) focus-visible:border-primary focus-visible:text-(--br-ember-hot)";
