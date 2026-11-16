// Class strings that more than one section of the Atelier Nord-Sud page uses.
// The section components join them with their own layout classes.
// landing.css sets the custom properties (--ns-bar, --ns-cyan, --ns-ink-deep) on .ns-scope.

/** The mono label voice of the drawing: 11px capitals with open tracking. The color comes from the caller. */
export const LABEL =
	"font-display font-medium text-[0.6875rem] uppercase leading-[1.4] tracking-[0.09em]";

/** The smallest mono cell key, 10px. A cartouche cell and a sheet fact use it above their value. */
export const CELL_KEY =
	"block font-display text-[0.625rem] text-foreground/60 uppercase tracking-[0.1em]";

/** The section title: the display face of the theme, weight 800, at the size of a drawing title. */
export const SECTION_TITLE =
	"ns-title text-balance text-[clamp(1.9rem,3.6vw,3.2rem)] leading-[1.05]";

/** Body text at the ink with 80% strength. It keeps a contrast above 7:1 on the paper. */
export const BODY = "text-foreground/80";

/** One section of the page. The anchor stops 8px below the sticky header. */
export const SECTION =
	"scroll-mt-[calc(var(--ns-bar)+8px)] py-[clamp(4.5rem,10vh,8rem)]";

// The two buttons share the box: square, mono capitals, and at least 48px tall for a thumb.
const BUTTON_BOX =
	"inline-flex min-h-12 items-center justify-center border-[1.5px] border-foreground px-6 py-3 text-center font-display font-semibold text-xs uppercase tracking-[0.08em] transition-colors duration-[180ms] ease-linear";

/** The filled action: ink on paper. It deepens on hover. Never red: red is the pencil. */
export const BUTTON_PRIMARY = `${BUTTON_BOX} bg-foreground text-background hover:border-(--ns-ink-deep) hover:bg-(--ns-ink-deep) focus-visible:bg-(--ns-ink-deep)`;

/** The ghost action: an ink frame that fills with ink on hover. */
export const BUTTON_GHOST = `${BUTTON_BOX} bg-transparent text-foreground hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background`;

/** A sheet panel: the near-white card ground in a 1.5px ink frame. Hover thickens the frame by 1px, inside. */
export const SHEET =
	"border-[1.5px] border-foreground bg-card ring-foreground ring-inset transition-shadow duration-[180ms] ease-linear focus-within:ring-1 hover:ring-1";
