// The bar chart of the event volume card: all events of the period per weekday, Monday first.
// EventVolumeCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// The bars fill with a vertical gradient from chart color 2 to chart color 1.
import { useId } from "react";
import { Bar, BarChart, XAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { weekdayName } from "../lib/weekdays";

type WeekdayBarsProps = {
	/** All events per weekday, Monday first: 7 numbers. */
	counts: number[];
};

/** One bar per weekday. The screen reader text lists each weekday and its count. */
export function WeekdayBars({ counts }: WeekdayBarsProps) {
	const { t, locale, dir } = useT();
	const gradientId = useId();
	const number = new Intl.NumberFormat(locale);
	const data = counts.map((events, index) => ({
		day: weekdayName(index, locale, "short"),
		events,
	}));
	const chartConfig = {
		events: { label: t("overview.volume.events"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-60 w-full"
			role="img"
			aria-label={`${t("overview.volume.title")}: ${data
				.map((point) => `${point.day} ${number.format(point.events)}`)
				.join(", ")}`}
		>
			<BarChart data={data} accessibilityLayer>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--chart-2)" />
						<stop offset="95%" stopColor="var(--chart-1)" />
					</linearGradient>
				</defs>
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					reversed={dir === "rtl"}
				/>
				<ChartTooltip
					cursor={false}
					content={<ChartTooltipContent hideIndicator />}
				/>
				<Bar
					dataKey="events"
					fill={`url(#${gradientId})`}
					radius={5}
					maxBarSize={50}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
