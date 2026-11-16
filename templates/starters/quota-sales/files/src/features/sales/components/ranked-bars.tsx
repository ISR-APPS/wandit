// Ranked rows with a bar under each row: the territory breakdown of the home and the product mix of a rep.
// The bar shows the share of the largest part. Each row also names its share of the total.
// The values are text, so the rows need no tooltip.
// It reads the locale of useT() to format the amounts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { moneyFormat, percentFormat } from "../lib/format";
import type { BreakdownSlice } from "../lib/series";

type RankedBarsProps = {
	/** The parts, largest first. Each value is an amount in CURRENCY. */
	slices: BreakdownSlice[];
	/** Layout classes of the list, for example to spread the rows over a stretched card. */
	className?: string;
};

/** Ranked amounts. The text sits above its bar, so a short bar never cuts a label. */
export function RankedBars({ slices, className }: RankedBarsProps) {
	const { locale } = useT();
	const money = moneyFormat(locale);
	const percent = percentFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const largest = Math.max(0, ...slices.map((slice) => slice.value));
	return (
		<ol className={cn("grid gap-4", className)}>
			{slices.map((slice) => (
				<li key={slice.label} className="grid gap-2 text-sm">
					<div className="flex items-baseline justify-between gap-3">
						<span className="truncate">{slice.label}</span>
						<span className="flex items-baseline gap-2 tabular-nums">
							<span className="text-muted-foreground text-xs">
								{percent.format(total > 0 ? slice.value / total : 0)}
							</span>
							<span className="font-medium">{money.format(slice.value)}</span>
						</span>
					</div>
					<div className="h-2 rounded-(--badge-radius) bg-muted">
						{/* A block bar grows from the start side: from the right in Arabic. */}
						<div
							className="h-full rounded-(--badge-radius) bg-chart-1"
							style={{
								width: `${largest > 0 ? (slice.value / largest) * 100 : 0}%`,
							}}
						/>
					</div>
				</li>
			))}
		</ol>
	);
}
