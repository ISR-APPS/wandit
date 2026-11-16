// Class strings that several sections of the home page share.
// The section components import them. landing.css defines the yr-* classes and the --yr-* variables.
// Colors are theme tokens: "primary" is the one grey of the world, "foreground" is the paper white.

/** The page container: 1360px wide at most, with the fluid gutter of the page. */
export const WRAP = "mx-auto w-full max-w-(--yr-max) px-(--yr-gutter)";

/** A mono line in grey capitals. It opens a section or a column. */
export const KICKER =
	"yr-mono block text-[0.7rem] text-primary uppercase leading-normal tracking-[0.16em]";

/** A section title in the display face. Each title is a short sentence with a full stop. */
export const H2 =
	"font-display font-extrabold text-[clamp(2rem,3.9vw,3.5rem)] leading-[1.04] tracking-[-0.028em]";

/** One line of mono facts in grey capitals: years, counts, roll numbers. */
export const META =
	"yr-mono text-[0.68rem] text-primary uppercase leading-normal tracking-[0.1em]";

/** Body prose. It is dimmer than the titles, so the titles stay the brightest text. */
export const PROSE = "text-pretty text-foreground/75";

/** A side note in grey, one step smaller than the prose. */
export const NOTE = "text-pretty text-[0.94rem] text-primary leading-[1.6]";

/** The mono label above a value in a facts list. */
export const LABEL =
	"yr-mono text-[0.64rem] text-primary uppercase leading-normal tracking-[0.13em]";

/** The mono rule under a photograph: the place in white, the date in grey. */
export const CAPTION =
	"yr-mono mt-2.5 text-[0.68rem] text-primary leading-normal tracking-[0.05em]";

// 46px keeps the touch area above 44px. No transition: a hover cuts, as a shutter does.
// Below 480px the type and the padding tighten, so two buttons stay on one row of a 360px phone.
const BUTTON =
	"yr-mono inline-flex min-h-[46px] items-center justify-center border px-[22px] text-[0.72rem] uppercase tracking-[0.14em] max-[479px]:px-3.5 max-[479px]:text-[0.66rem] max-[479px]:tracking-[0.1em]";

/** The main action: a white plate that turns into an outline on hover and on focus. */
export const BUTTON_FILL = `${BUTTON} border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:text-foreground`;

/** The second action: a hairline frame that fills with white on hover and on focus. */
export const BUTTON_GHOST = `${BUTTON} border-foreground/30 text-foreground hover:border-foreground hover:bg-foreground hover:text-background focus-visible:border-foreground focus-visible:bg-foreground focus-visible:text-background`;
