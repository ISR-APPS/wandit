// Class strings that more than one section of the Sina Polyclinic page uses.
// The section components join them with their own layout classes.
// The custom properties (--sp-pad, --sp-chamfer, --sp-teal-deep) are set in landing.css on .sp-scope.
// The page has two own breakpoints, written in rem so that Tailwind sorts them with md and lg: 56.25rem is 900px, 67.5rem is 1080px.

/** The page container: 1240px wide with the side padding of the page inside it. */
export const WRAP = "mx-auto w-full max-w-310 px-(--sp-pad)";

/** The small-caps label of 11px: the only capital text of the page. The caller sets the color: deep teal or muted ink. */
export const LABEL =
	"font-sans font-semibold text-[0.6875rem] uppercase tracking-[0.15em]";

/** The section title in the serif face at the regular weight. Emphasis is the teal color, never italics. */
export const SECTION_TITLE =
	"text-balance font-display font-normal text-[clamp(1.9rem,3.3vw,2.95rem)] leading-[1.1] tracking-[-0.018em]";

/** The lead paragraph beside a section title. 52 characters is the longest line that reads at one glance. */
export const LEDE =
	"max-w-[52ch] text-[clamp(1rem,1.15vw,1.125rem)] text-muted-foreground leading-[1.7]";

/** A flat surface: a 1px hairline and the 2px chamfer. The page has no shadow. */
export const PLATE = "rounded-(--sp-chamfer) border border-border bg-card";

// The two buttons share the box. 44px is the touch height of a phone.
const BUTTON_BOX =
	"inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-(--sp-chamfer) border px-5 font-medium text-sm transition-colors duration-200";

/** The filled action. The deep teal keeps the light text above a contrast of 4.5:1. */
export const BUTTON_FILLED = `${BUTTON_BOX} border-(--sp-teal-deep) bg-(--sp-teal-deep) text-card hover:border-(--sp-teal-deeper) hover:bg-(--sp-teal-deeper)`;

/** The quiet action: a hairline that turns teal on hover. */
export const BUTTON_GHOST = `${BUTTON_BOX} border-border text-foreground hover:border-primary hover:text-(--sp-teal-deep)`;
