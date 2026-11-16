// Class strings of the recurring type of the home page: the brass small caps and the two buttons.
// The section files read them, so a label looks the same in a tab, on a rule, and on a plate.
// The colors come from the page inks of landing.css (--vt-brass and the others).

/** Brass small caps, 11px with wide tracking. A label never floats: it sits in a tab, on a rule, or after "Art. n". */
export const LABEL =
	"font-sans font-semibold text-[11px] leading-none uppercase tracking-[0.16em]";

/** The text of a button: sans 600 at 11.5px, capitals with wide tracking. Add it to "vt-btn". */
export const BUTTON_TEXT =
	"font-sans font-semibold text-[11.5px] leading-tight uppercase tracking-[0.15em]";

/** Section titles in the display serif, 1.9rem to 2.9rem. */
export const SECTION_TITLE =
	"font-display font-normal text-[clamp(1.9rem,3.3vw,2.9rem)] leading-[1.1] tracking-[-0.012em]";
