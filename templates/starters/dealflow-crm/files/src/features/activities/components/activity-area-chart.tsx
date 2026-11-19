// The area chart of the trend card: the activities of each day, or their running total, over the period.
// ActivityTrendCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the chart form "area" of the app-dashboard skill: a monotone line, a gradient fill, and compact ticks.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type DailyPoint, dayToDate, fillMessage } from "~/features/crm";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type ActivityAreaChartProps = {
	/** One point per day, oldest first. `current` is the plotted value; `previous` is not drawn. */
	points: DailyPoint[];
};

/** The aria-label names the last day and its value, so the chart is not a picture only. */
export function ActivityAreaChart({ points }: ActivityAreaChartProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const isRtl = dir === "rtl";
	const lastPoint = points.at(-1);
	const chartConfig = {
		current: { label: t("activities.title"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-64 w-full"
			role="img"
			aria-label={
				lastPoint
					? fillMessage(t("activities.trendLabel"), {
							day: dayFormat.format(dayToDate(lastPoint.day)),
							count: number.format(lastPoint.current),
						})
					: t("activities.trendTitle")
			}
		>
			<AreaChart
				data={points}
				// The margin on the axis side keeps the ticks off the edge of the plot.
				margin={{
					top: 8,
					bottom: 0,
					left: isRtl ? 0 : 4,
					right: isRtl ? 4 : 0,
				}}
			>
				<defs>
					<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0%"
							stopColor="var(--color-current)"
							stopOpacity={0.3}
						/>
						<stop
							offset="100%"
							stopColor="var(--color-current)"
							stopOpacity={0}
						/>
					</linearGradient>
				</defs>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					reversed={isRtl}
					tickFormatter={(day: string) => dayFormat.format(dayToDate(day))}
				/>
				<YAxis
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					allowDecimals={false}
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Area
					dataKey="current"
					type="monotone"
					stroke="var(--color-current)"
					fill={`url(#${fillId})`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
