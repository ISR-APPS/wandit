// The small area chart under the large figure of the home.
// KpiFigureCard renders it. It follows the KPI form "spark" of the app-dashboard skill.
import { useId } from "react";
import { Area, AreaChart, XAxis } from "recharts";
import { useT } from "~/shared/i18n";
import { type ChartConfig, ChartContainer } from "~/shared/ui/chart";

const SPARK_CONFIG = {
	value: { color: "var(--chart-1)" },
} satisfies ChartConfig;

type KpiSparkProps = {
	/** One value per day, oldest first. */
	series: number[];
};

/** Fewer than 2 values: no spark, and the text of the figure stays. */
export function KpiSpark({ series }: KpiSparkProps) {
	const { dir } = useT();
	const fillId = useId();
	if (series.length < 2) {
		return null;
	}
	return (
		// The text of the figure gives the value and the change, so screen readers skip the spark.
		<ChartContainer
			aria-hidden="true"
			config={SPARK_CONFIG}
			className="mt-auto aspect-auto h-28 w-full"
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
