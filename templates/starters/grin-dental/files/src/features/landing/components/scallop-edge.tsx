// A row of scallops that seams a colored band into the cream page. The visit and price bands render one above and below.
// It stretches to the full width; its height follows the width (60 / 1440 of it).
import { cn } from "~/shared/lib/utils";

const SCALLOP_PATH =
	"M0,48 Q40,-14 80,48 Q120,-14 160,48 Q200,-14 240,48 Q280,-14 320,48 Q360,-14 400,48 Q440,-14 480,48 Q520,-14 560,48 Q600,-14 640,48 Q680,-14 720,48 Q760,-14 800,48 Q840,-14 880,48 Q920,-14 960,48 Q1000,-14 1040,48 Q1080,-14 1120,48 Q1160,-14 1200,48 Q1240,-14 1280,48 Q1320,-14 1360,48 Q1400,-14 1440,48 L1440,60 L0,60 Z";

/**
 * `fillClass` gives the band color, for example fill-(--gd-teal).
 * `flip` turns the edge upside down for the bottom of a band.
 */
export function ScallopEdge({
	fillClass,
	flip = false,
}: {
	fillClass: string;
	flip?: boolean;
}) {
	return (
		<svg
			viewBox="0 0 1440 60"
			preserveAspectRatio="none"
			aria-hidden="true"
			focusable="false"
			// The 1px overlap hides the hairline gap that sub-pixel heights leave between the edge and the band.
			className={cn(
				"block h-auto w-full",
				flip ? "-mt-px -scale-y-100" : "-mb-px",
			)}
		>
			<path d={SCALLOP_PATH} className={fillClass} />
		</svg>
	);
}
