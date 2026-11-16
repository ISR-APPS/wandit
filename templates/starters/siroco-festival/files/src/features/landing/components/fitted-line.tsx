// One line of display caps fitted to 100% of its box width: the owned tic of the poster world.
// The hero, the headliner posters, the booking sheet, and the footer render it.
// landing.css sizes it from --sf-fit; hooks/use-fit-lines.ts corrects the share after the fonts load.
import type { CSSProperties } from "react";
import { cn } from "~/shared/lib/utils";

type FittedLineProps = {
	text: string;
	/** Font size as a share of the box width, measured for Anton caps with 0.01em tracking. */
	fit: number;
	/** Upper limit of the font size as a CSS length, for example "70svh". None by default. */
	cap?: string;
	/** Classes of the box: the width, the margins, and the responsive display. */
	className?: string;
};

/** A block box with one line of caps inside. The line never wraps; a sheet edge crops any rounding rest. */
export function FittedLine({ text, fit, cap, className }: FittedLineProps) {
	const style: CSSProperties &
		Record<"--sf-fit", number> &
		Partial<Record<"--sf-fit-cap", string>> = {
		"--sf-fit": fit,
		"--sf-fit-cap": cap,
	};
	return (
		<span className={cn("sf-fit-box block", className)}>
			<span className="sf-fit font-display uppercase" style={style}>
				<span>{text}</span>
			</span>
		</span>
	);
}
