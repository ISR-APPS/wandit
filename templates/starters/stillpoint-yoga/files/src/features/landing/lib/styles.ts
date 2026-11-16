// The class strings that several sections of the home page share: the column, the section rhythm,
// the titles, the tracked label, and the three buttons. The section components import them.
// The colors are token classes or the --sp-* page colors of landing.css.

/** The content column: 1180px at most, with a gutter of 22px on a phone and 72px on a wide screen. */
export const WRAP = "mx-auto w-full max-w-[1180px] px-[clamp(22px,5vw,72px)]";

/** The vertical space of a regular section: 92px on a phone, up to 150px on a tall screen. */
export const SECTION_Y = "py-[clamp(92px,12vh,150px)]";

/** A section title: Fraunces at its lightest host weight, 400. */
export const SECTION_TITLE =
	"text-balance font-display font-normal text-[clamp(2.4rem,5vw,4.2rem)] leading-[1.06] tracking-[-0.015em]";

/** The lede under a section title, in 78% ink. */
export const LEDE = "max-w-[52ch] text-pretty text-(--sp-ink-78)";

/** The small tracked label of rows, prices, and captions, in 64% ink. */
export const LABEL =
	"font-bold font-sans text-[0.72rem] text-(--sp-ink-64) uppercase leading-[1.5] tracking-[0.22em]";

/** The three buttons share this base: a pill of 44px or more, a bold tracked label. */
const BUTTON_BASE =
	"inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-full border px-[26px] py-[13px] font-bold font-sans text-[0.84rem] uppercase leading-none tracking-[0.09em] no-underline transition-[background-color,color,border-color,translate] duration-500 ease-(--sp-ease) hover:-translate-y-0.5";

/** The ink button: the main action. It turns sage on hover. */
export const INK_BUTTON = `${BUTTON_BASE} border-foreground bg-foreground text-background hover:border-primary hover:bg-primary hover:text-primary-foreground`;

/** The ghost button: a hairline that darkens to ink on hover. */
export const GHOST_BUTTON = `${BUTTON_BASE} border-(--sp-line) bg-transparent text-foreground hover:border-foreground`;

/** The bone button: for clay and night grounds. */
export const BONE_BUTTON = `${BUTTON_BASE} border-(--sp-bone) bg-(--sp-bone) text-(--sp-terra-ink) hover:bg-background`;
