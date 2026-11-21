// The bars of the engagement report: the engagements of the posts published on each weekday, Monday first.
// EngagementReportCard loads this file with React.lazy, so the chart library stays out of the first script.
// The bars use a fill that runs from chart color 2 at the top to chart color 1 at the base.
import { useId } from "react";
import { Bar, BarChart, XAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

// 1 January 2024 is a Monday. Adding 0 to 6 days gives the weekday names in the order of the chart.
const FIRST_MONDAY_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

type WeekdayBarsProps = {
	/** Engagements per weekday, Monday first: 7 values. */
	values: number[];
	/** The name of the series, already translated. */
	seriesLabel: string;
};

/** The screen reader text lists each weekday with its count. */
export function WeekdayBars({ values, seriesLabel }: WeekdayBarsProps) {
	const { locale, dir } = useT();
	const fillId = useId();
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const number = new Intl.NumberFormat(locale);
	const data = values.map((value, index) => ({
		day: weekday.format(new Date(FIRST_MONDAY_MS + index * DAY_MS)),
		value,
	}));
	const chartConfig = {
		value: { label: seriesLabel, color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-60 w-full"
			role="img"
			aria-label={`${seriesLabel}: ${data
				.map((point) => `${point.day} ${number.format(point.value)}`)
				.join(", ")}`}
		>
			<BarChart data={data} margin={{ top: 8, left: 0, right: 0 }}>
				<defs>
					<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--chart-2)" />
						<stop offset="95%" stopColor="var(--chart-1)" />
					</linearGradient>
				</defs>
				{/* Monday stays at the start side of the page, also in Arabic. */}
				<XAxis
					dataKey="day"
					reversed={dir === "rtl"}
					tickLine={false}
					axisLine={false}
					tickMargin={10}
				/>
				<ChartTooltip
					cursor={false}
					content={<ChartTooltipContent hideLabel={false} />}
				/>
				<Bar
					dataKey="value"
					fill={`url(#${fillId})`}
					radius={6}
					maxBarSize={48}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
