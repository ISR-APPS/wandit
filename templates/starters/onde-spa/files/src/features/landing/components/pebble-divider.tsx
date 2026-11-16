// A divider of the Onde world: one drifting pebble between two hairlines.
// The threshold strip, the treatments aside, the water quote, and the info plate render it. One per block.
import { cn } from "~/shared/lib/utils";
import { PebbleGlyph, type PebblePhase } from "./pebble-glyph";

type PebbleDividerProps = {
	/** Spacing classes of the divider, for example "mt-7". */
	className?: string;
	/** Drift phase of the pebble. */
	phase?: PebblePhase;
};

/** Punctuation, not decoration: the hairlines grow to fill the column. */
export function PebbleDivider({ className, phase }: PebbleDividerProps) {
	return (
		<div aria-hidden="true" className={cn("onde-pebble-divider", className)}>
			<PebbleGlyph phase={phase} className="onde-drift text-(--onde-sage)" />
		</div>
	);
}
