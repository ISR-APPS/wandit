// One result of the twelve-week program: a big figure that counts up, and its label.
// distance-section.tsx renders one for each entry of DISTANCE_STATS.
// It reads use-in-view.ts for the entrance and use-count-up.ts for the number.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useCountUp } from "../hooks/use-count-up";
import { useInView } from "../hooks/use-in-view";
import type { DistanceStat } from "../lib/content";

/** A figure with its sign and unit, for example "−100%". The server HTML holds the final number. */
export function StatFigure({ stat }: { stat: DistanceStat }) {
	const { t } = useT();
	const { ref, phase } = useInView();
	const value = useCountUp(stat.value, phase === "entered");
	return (
		<p ref={ref} className="flex items-baseline gap-3">
			<b
				className={cn(
					"font-display font-extrabold text-[2.6rem] tabular-nums leading-none",
					stat.isGold && "sp-gold",
				)}
			>
				{stat.prefix}
				{value}
				{stat.suffix}
			</b>
			<span className="font-bold text-[0.66rem] text-muted-foreground uppercase leading-snug tracking-[0.22em]">
				{t(stat.label)}
			</span>
		</p>
	);
}
