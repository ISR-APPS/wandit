// The vitals line: one thin ECG trace across the full width of the page. It is the divider of the page.
// The hero, the oath band, and the footer render it. landing.css draws its stroke and its entrance.
// The drawing stretches with the screen, so the beat is shorter on a phone.
import { cn } from "~/shared/lib/utils";

// One beat, 240 units wide: flat, P wave, QRS spike, T wave, flat.
const BEAT =
	"h90 l10 -4 l10 4 h20 l6 4 l7 -19 l7 22 l6 -7 h24 l14 -7 l14 7 h32";
// Six beats fill the 1440 units of the drawing.
const LINE_PATH = `M0 24 ${Array.from({ length: 6 }, () => BEAT).join(" ")}`;

type VitalsLineProps = {
	/**
	 * When the line draws itself. "load" is for the first screen: a CSS animation with no script.
	 * "scroll" waits until the line scrolls into view. "none" shows the line complete: the footer is the end of the page.
	 */
	entrance: "load" | "scroll" | "none";
	/** The color (a text class), the opacity, and the margins. */
	className?: string;
};

/** A decorative trace, 48px high. It draws at most one time, from left to right. */
export function VitalsLine({ entrance, className }: VitalsLineProps) {
	return (
		<svg
			viewBox="0 0 1440 48"
			preserveAspectRatio="none"
			aria-hidden="true"
			data-reveal={entrance === "scroll" ? "draw" : undefined}
			className={cn(
				"sp-ecg block h-12 w-full",
				entrance === "load" && "sp-draw",
				className,
			)}
		>
			<path d={LINE_PATH} strokeWidth="1.5" />
		</svg>
	);
}
