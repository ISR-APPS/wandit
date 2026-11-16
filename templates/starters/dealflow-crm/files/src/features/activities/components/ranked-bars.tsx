// Ranked parts of one total: a bar behind each name, and the count in its own column at the end.
// The breakdown card of the activities page renders one list per breakdown.
// The bars are plain elements, not a chart, so a long name stays readable in a short bar.
import type { BreakdownSlice } from "~/features/crm";
import { useT } from "~/shared/i18n";

type RankedBarsProps = {
	/** The parts, largest first, with translated labels. */
	slices: BreakdownSlice[];
};

/** The bar of a row shows its share of the largest part. */
export function RankedBars({ slices }: RankedBarsProps) {
	const { locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const largest = Math.max(0, ...slices.map((slice) => slice.value));
	return (
		<ol className="grid gap-1.5">
			{slices.map((slice) => (
				// The count has its own column of 2.5rem, so the end of a long bar never cuts through it.
				<li
					key={slice.label}
					className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 text-sm"
				>
					<div className="relative flex h-8 items-center px-2.5">
						{/* start-0 makes the bar grow from the start side: from the right in Arabic. */}
						<div
							className="absolute inset-y-0 start-0 rounded-sm bg-chart-1/20"
							style={{
								width: `${largest > 0 ? (slice.value / largest) * 100 : 0}%`,
							}}
						/>
						<span className="relative truncate">{slice.label}</span>
					</div>
					<span className="text-end font-medium tabular-nums">
						{number.format(slice.value)}
					</span>
				</li>
			))}
		</ol>
	);
}
