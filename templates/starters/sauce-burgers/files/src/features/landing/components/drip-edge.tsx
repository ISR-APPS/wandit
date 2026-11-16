// The drip edge: a run of sauce that hangs from the top of a section into its ground.
// Each section whose ground differs from the section above renders one as its first child.
// It reads the path data of lib/drip-paths.ts. The section must be `relative`.
import { cn } from "~/shared/lib/utils";
import { DRIP_PATHS, type DripVariant } from "../lib/drip-paths";

/** The ground color of the section ABOVE the edge. The drips take that color. */
type DripTone = "cream" | "hot" | "mustard";

const FILL_OF: Record<DripTone, string> = {
	cream: "fill-background",
	hot: "fill-primary",
	mustard: "fill-(--sc-mustard)",
};

type DripEdgeProps = {
	/** Which of the three drawings. Use a different one than the edge above. */
	variant: DripVariant;
	/** The ground color of the section above this one. */
	tone: DripTone;
};

/** Decorative. It draws the wide path from 721px and the narrow path on a phone, so the runs keep their shape. */
export function DripEdge({ variant, tone }: DripEdgeProps) {
	const paths = DRIP_PATHS[variant];
	const svgClass = cn("h-(--sc-drip) w-full", FILL_OF[tone]);
	return (
		// -top-px hides the hairline that a fractional section height can leave above the drips.
		<span
			aria-hidden="true"
			className="pointer-events-none absolute inset-x-0 -top-px z-3 block leading-none"
		>
			<svg
				viewBox="0 0 1440 66"
				preserveAspectRatio="none"
				aria-hidden="true"
				focusable="false"
				className={cn(svgClass, "hidden min-[721px]:block")}
			>
				<path d={paths.wide} />
			</svg>
			<svg
				viewBox="0 0 900 66"
				preserveAspectRatio="none"
				aria-hidden="true"
				focusable="false"
				className={cn(svgClass, "block min-[721px]:hidden")}
			>
				<path d={paths.narrow} />
			</svg>
		</span>
	);
}
