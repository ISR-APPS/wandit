// The small area chart under one figure of the facts row: the shape of the 30 days.
// KpiFacts renders it. Screen readers skip it: the text above gives the value and the change.
// A count starts at 0, so a small change shows as a small move. A rate starts just under its lowest day,
// because a rate near 100 % on a 0 scale is a flat block.
import { useId } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import { type ChartConfig, ChartContainer } from "~/shared/ui/chart";

const SPARK_CONFIG = {
	value: { color: "var(--chart-1)" },
} satisfies ChartConfig;

type KpiSparkProps = {
	/** One value per day, oldest first. */
	series: number[];
	/** True when each value is a ratio from 0 to 1, for example a check-in rate. */
	isRate: boolean;
};

// The rate scale starts 5 points under the lowest day, so the daily rhythm fills the spark.
const RATE_SCALE_MARGIN = 0.05;

/** Fewer than 2 values: no spark, and the text of the figure stays. */
export function KpiSpark({ series, isRate }: KpiSparkProps) {
	const { dir } = useT();
	const fillId = useId();
	if (series.length < 2) {
		return null;
	}
	return (
		<ChartContainer
			aria-hidden="true"
			config={SPARK_CONFIG}
			className="mt-auto aspect-auto h-10 w-full"
		>
			{/* The 4 px top margin keeps the stroke of the highest value inside the chart. */}
			<AreaChart
				data={series.map((value, day) => ({ day, value }))}
				margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
			>
				<defs>
					<linearGradient id={fillId}>
						<stop stopColor="var(--color-value)" stopOpacity={0.2} />
					</linearGradient>
				</defs>
				{/* Time runs from right to left in Arabic. */}
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<YAxis
					hide
					domain={
						isRate
							? [Math.max(0, Math.min(...series) - RATE_SCALE_MARGIN), 1]
							: [0, "auto"]
					}
				/>
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
