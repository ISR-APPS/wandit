// The class strings that several sections of the home page share: the column, the section rhythm,
// the titles, the lowercase label, and the two buttons. The section components import them.
// The values come from the Onde world: a calm serif scale, lowercase tracked labels, 12px controls.

/** The content column: 1240px at most, with a gutter of 20px on a phone and 64px on a wide screen. */
export const WRAP = "mx-auto w-[min(1240px,100%_-_2*clamp(20px,4.4vw,64px))]";

/** The vertical space of a regular section: 5rem on a phone, 8.5rem on a tall screen. */
export const SECTION_Y = "py-[clamp(5rem,10.5vh,8.5rem)]";

/** A section title: the display serif at its only weight, 400. */
export const SECTION_TITLE =
	"text-balance font-display font-normal text-[clamp(2rem,3.8vw,3.35rem)] leading-[1.1] tracking-[-0.008em]";

/** A card or row title: one step down from the section title. */
export const ITEM_TITLE =
	"font-display font-normal text-[clamp(1.25rem,1.7vw,1.6rem)] leading-[1.2] tracking-[-0.008em]";

/** The world label: body face, lowercase, tracked 0.26em, in sage ink. Never in a pill. */
export const LABEL =
	"font-medium font-sans text-[0.71rem] text-primary lowercase leading-[1.4] tracking-[0.26em]";

/** A tracked small line for durations and temperatures, in sage ink with tabular figures. */
export const META =
	"font-sans text-[0.73rem] text-primary tabular-nums tracking-[0.16em]";

/** Body copy at 72% ink, the world's reading tone. */
export const BODY_TEXT = "text-(--onde-ink-72)";

/** The primary button: sage-ink fill with a light label. It deepens on hover and on keyboard focus. */
export const PRIMARY_BUTTON =
	"inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-md border border-primary bg-primary px-6 py-[0.92rem] font-medium font-sans text-[0.9rem] text-primary-foreground leading-none tracking-[0.03em] no-underline transition-colors duration-[400ms] ease-(--onde-tide) hover:border-(--onde-sage-deep) hover:bg-(--onde-sage-deep) focus-visible:border-(--onde-sage-deep) focus-visible:bg-(--onde-sage-deep)";

/** The ghost button: a 30% ink hairline that turns sage on hover and on keyboard focus. */
export const GHOST_BUTTON =
	"inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-md border border-(--onde-hair-strong) bg-transparent px-6 py-[0.92rem] font-medium font-sans text-[0.9rem] text-primary leading-none tracking-[0.03em] no-underline transition-colors duration-[400ms] ease-(--onde-tide) hover:border-(--onde-sage) hover:text-foreground focus-visible:border-(--onde-sage) focus-visible:text-foreground";
