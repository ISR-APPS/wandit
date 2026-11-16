// The class strings that several sections of the home page share: the gutter, the column, the section
// rhythm, the section title, and the two capsule buttons. The section components import them.
// The values come from the Éclat world: a cream gutter that no photo crosses, and a calm serif scale.

/** The permanent cream gutter, 16px on a phone and 64px on a wide screen. No photo crosses it. */
export const GUTTER = "px-[clamp(16px,4vw,64px)]";

/** The content column, 1240px at most. */
export const WRAP = "mx-auto w-full max-w-[1240px]";

/** The vertical space of a section: 4.5rem on a phone, 8rem on a tall screen. */
export const SECTION_Y = "py-[clamp(4.5rem,10vh,8rem)]";

/** A section title: the display serif, roman, at weight 400 (the only weight of the face). 34px at least on a phone. */
export const SECTION_TITLE =
	"text-balance font-display font-normal text-[clamp(2.15rem,3.6vw,3.4rem)] leading-[1.08] tracking-[-0.01em]";

/** The primary capsule: a bronze fill with cream text. It deepens and grows 2% on hover and focus. */
export const PRIMARY_CAPSULE =
	"inline-flex min-h-[50px] items-center justify-center rounded-full bg-primary px-[29px] py-3.5 text-center font-semibold text-[15px] text-background leading-tight no-underline transition-[background-color,transform] duration-[350ms] hover:scale-[1.02] hover:bg-(--lumia-bronze-deep) focus-visible:scale-[1.02] focus-visible:bg-(--lumia-bronze-deep) active:bg-(--lumia-bronze-deep) motion-reduce:transition-none motion-reduce:hover:scale-100";

/** The ghost capsule: a cacao outline at 25% that fills with blush on hover. */
export const GHOST_CAPSULE =
	"inline-flex min-h-[50px] items-center justify-center rounded-full border border-foreground/25 bg-card/30 px-[26px] py-3 text-center font-semibold text-[15px] text-foreground leading-tight no-underline transition-colors duration-[350ms] hover:bg-(--lumia-blush)/60 focus-visible:bg-(--lumia-blush)/60 active:bg-(--lumia-blush)/60";
