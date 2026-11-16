// The pebble stack of the Onde world: three rounded stones, one on the other, drawn in currentColor.
// PebbleDivider, TreatmentRow, and SiteMenu render it. It is decoration, so screen readers skip it.
import { cn } from "~/shared/lib/utils";

/** Loop phase of the drift. 0 is the base loop; landing.css gives 1 to 4 a longer duration. */
export type PebblePhase = 0 | 1 | 2 | 3 | 4;

type PebbleGlyphProps = {
	/** Size, color, and motion classes, for example "text-(--onde-sage) onde-drift". */
	className?: string;
	/** Drift phase, so two pebbles never move together. */
	phase?: PebblePhase;
};

/** A 24 x 22 glyph. The lower stones are more opaque, as stones that carry weight. */
export function PebbleGlyph({ className, phase }: PebbleGlyphProps) {
	return (
		<svg
			viewBox="0 0 24 22"
			aria-hidden="true"
			focusable="false"
			data-phase={phase}
			className={cn("block h-[22px] w-6 shrink-0", className)}
		>
			<rect
				x="1.2"
				y="14.4"
				width="21.6"
				height="6.4"
				rx="3.2"
				fill="currentColor"
				opacity="0.92"
			/>
			<rect
				x="4.4"
				y="7.6"
				width="15.2"
				height="5.8"
				rx="2.9"
				fill="currentColor"
				opacity="0.72"
			/>
			<rect
				x="8"
				y="1.8"
				width="8"
				height="4.8"
				rx="2.4"
				fill="currentColor"
				opacity="0.54"
			/>
		</svg>
	);
}
