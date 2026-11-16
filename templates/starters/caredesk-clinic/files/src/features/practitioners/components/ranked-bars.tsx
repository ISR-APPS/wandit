// Ranked parts of one total: a bar behind each row, the name at the start, the value at the end.
// The two breakdown panels of the practitioners page render it.
// The bars are plain elements, not a chart, so a long name stays readable in a short bar.
import { useT } from "~/shared/i18n";

type RankedBarsProps = {
	/** The parts, in the order to show, with translated labels. */
	slices: { label: string; value: number }[];
};

/** The bar of a row shows its share of the largest part. The values are text, so they need no tooltip. */
export function RankedBars({ slices }: RankedBarsProps) {
	const { locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const largest = Math.max(0, ...slices.map((slice) => slice.value));
	return (
		<ol className="grid gap-1.5">
			{slices.map((slice) => (
				<li
					key={slice.label}
					className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3 text-sm"
				>
					{/* The value has its own column of one width, so no bar runs under its digits. */}
					<div className="relative flex h-8 min-w-0 items-center px-2.5">
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
