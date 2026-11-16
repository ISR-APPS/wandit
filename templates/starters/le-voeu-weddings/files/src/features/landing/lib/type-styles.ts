// Class strings that several sections of the home page share: the page column, the type scale, the labels, and the actions.
// The section components of this feature import them. The values come from the VOEU world:
// a display serif at weight 400, tracked capitals on a gold rule, square rose buttons.
// The --voeu-* variables are in landing.css, on the .voeu-scope class.

/** The page column: 1280px at most, with the side padding of the page. */
export const WRAP = "mx-auto w-full max-w-[1280px] px-(--voeu-pad)";

/** The vertical padding of a section: 3.6rem on a phone, 6.4rem on a wide screen. */
export const SECTION = "py-(--voeu-rhythm)";

/** Tracked capitals at 11px. Ink at 68% keeps a contrast of 4.5:1 on both grounds. */
const LABEL_TYPE =
	"font-bold text-[11px] text-foreground/68 uppercase leading-[1.4] tracking-[0.24em]";

/** A label hung on a 34px gold hairline. The world never shows a bare label. */
export const LABEL = `${LABEL_TYPE} flex items-center gap-[14px] before:h-px before:w-[34px] before:flex-none before:bg-(--voeu-gold) before:content-['']`;

/** A centred label with a gold hairline on each side. Only the reply card uses it. */
export const LABEL_CENTRED = `${LABEL} justify-center after:h-px after:w-[34px] after:flex-none after:bg-(--voeu-gold) after:content-['']`;

/** The page title: three short lines, 5.6rem at most. Gilda has one weight, 400. */
export const H1 =
	"font-display font-normal text-[clamp(2.75rem,6.6vw,5.6rem)] leading-[1.06] tracking-[-0.004em]";

/** A section title. */
export const H2 =
	"font-display font-normal text-[clamp(2.05rem,4.3vw,3.55rem)] leading-[1.08] tracking-[-0.004em]";

/** A sub-head: a service, a stage, a package. */
export const H3 =
	"font-display font-normal text-[clamp(1.4rem,2vw,1.85rem)] leading-[1.15]";

/** The first paragraph beside a title: 56 characters wide at most. */
export const LEDE =
	"max-w-[56ch] text-pretty text-[clamp(1rem,0.96rem+0.18vw,1.075rem)] text-foreground/78 leading-[1.76]";

/** Running text: 60 characters wide at most. */
export const BODY =
	"max-w-[60ch] text-pretty text-[0.985rem] text-foreground/78 leading-[1.74]";

/** A small side note, set on a quiet gold rule. */
export const NOTE =
	"border-(--voeu-gold-soft) border-t pt-4 text-pretty text-[0.9rem] text-foreground/72 leading-[1.7]";

/** The caption under a photo: caps at 10.5px on a 22px gold rule. Every photo of the page has one. */
export const CAPTION =
	"mt-[13px] flex items-start gap-3 font-bold text-[10.5px] text-foreground/68 uppercase leading-[1.7] tracking-[0.17em] before:mt-[0.85em] before:h-px before:w-[22px] before:flex-none before:bg-(--voeu-gold) before:content-['']";

/** A small rose fact in capitals. The deep rose keeps a contrast of 4.5:1 at 10.5px. */
export const ROSE_FACT =
	"font-bold text-(--voeu-rose-deep) text-[10.5px] uppercase leading-[1.6] tracking-[0.15em]";

/** The main action: a square rose button. The fill deepens on hover. No shadow and no lift. */
export const BUTTON =
	"voeu-swap inline-flex min-h-12 items-center justify-center bg-(--voeu-rose-deep) px-[34px] py-[17px] text-center font-bold text-[12.5px] text-background uppercase leading-[1.3] tracking-[0.17em] hover:bg-(--voeu-rose-pressed) focus-visible:bg-(--voeu-rose-pressed)";

/** The second action: a transparent button with a 1px gold border. Border and text turn rose on hover. */
export const BUTTON_GHOST =
	"voeu-swap inline-flex min-h-12 items-center justify-center border border-(--voeu-gold-line) px-[33px] py-[16px] text-center font-bold text-[12.5px] text-foreground uppercase leading-[1.3] tracking-[0.17em] hover:border-primary hover:text-(--voeu-rose-deep) focus-visible:border-primary focus-visible:text-(--voeu-rose-deep)";

/** A text link in capitals on a gold underline. The touch area is 44px high. */
export const TEXT_LINK =
	"voeu-swap group inline-flex min-h-11 items-center font-bold text-[11.5px] text-foreground uppercase leading-none tracking-[0.17em] hover:text-(--voeu-rose-deep) focus-visible:text-(--voeu-rose-deep)";

/** The gold underline of a TEXT_LINK. Put it on a span inside the link. */
export const TEXT_LINK_RULE =
	"voeu-swap border-(--voeu-gold) border-b pb-1 group-hover:border-primary group-focus-visible:border-primary";
