// The small trend of one catalog row: the daily volume of an event as a mini area chart.
// EventCatalogCard renders one per row. It follows the spark of the KPI form "spark" of the app-dashboard skill.
import { useId } from "react";
import { Area, AreaChart, XAxis } from "recharts";
import { useT } from "~/shared/i18n";
import { type ChartConfig, ChartContainer } from "~/shared/ui/chart";

const MINI_TREND_CONFIG = {
	value: { color: "var(--chart-1)" },
} satisfies ChartConfig;

type MiniTrendProps = {
	/** One value per day, oldest first. */
	series: number[];
};

/** The row gives the volume and the change as text, so screen readers skip the chart. */
export function MiniTrend({ series }: MiniTrendProps) {
	const { dir } = useT();
	const fillId = useId();
	if (series.length < 2) {
		return null;
	}
	return (
		<ChartContainer
			aria-hidden="true"
			config={MINI_TREND_CONFIG}
			className="aspect-auto h-8 w-24"
		>
			{/* The 4 px top margin keeps the stroke of the highest value inside the chart. */}
			<AreaChart
				data={series.map((value, day) => ({ day, value }))}
				margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
			>
				<defs>
					<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0%"
							stopColor="var(--color-value)"
							stopOpacity={0.3}
						/>
						<stop
							offset="100%"
							stopColor="var(--color-value)"
							stopOpacity={0}
						/>
					</linearGradient>
				</defs>
				{/* Time runs from right to left in Arabic. */}
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<Area
					dataKey="value"
					type="monotone"
					stroke="var(--color-value)"
					fill={`url(#${fillId})`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
