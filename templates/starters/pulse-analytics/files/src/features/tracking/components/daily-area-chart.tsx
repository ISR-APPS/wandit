// One daily series as a line with a soft fill: the plot of every trend panel of the app.
// The home trend, the activity card of an account, and the detail card of an event render it.
// It follows the chart form "area" of the app-dashboard skill. The parent gives the points and the height class.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { fillMessage } from "../lib/format";
import { changeRatio, type DailyPoint } from "../lib/series";
import { dayToDate } from "../lib/time";

type DailyAreaChartProps = {
	/** One point per day, oldest first. */
	points: DailyPoint[];
	/** The name of the series, already translated. The tooltip and the screen reader text show it. */
	seriesLabel: string;
	/** The height class of the plot, for example "h-64". The width is the width of the parent. */
	className?: string;
	/** A main chart shows the Y axis. A side chart hides it. */
	showYAxis?: boolean;
};

/** The screen reader text gives the last day, its value, and its change against the same day one period earlier. */
export function DailyAreaChart({
	points,
	seriesLabel,
	className,
	showYAxis = true,
}: DailyAreaChartProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	const chartConfig = {
		current: { label: seriesLabel, color: "var(--chart-1)" },
	} satisfies ChartConfig;

	const lastPoint = points.at(-1);
	// The change shows only when the same day one period earlier had a value.
	const lastChange =
		lastPoint && lastPoint.previous > 0
			? changeRatio(lastPoint.current, lastPoint.previous)
			: null;
	const isRtl = dir === "rtl";

	return (
		<ChartContainer
			config={chartConfig}
			className={cn("aspect-auto w-full", className)}
			role="img"
			aria-label={
				lastPoint
					? fillMessage(
							t(lastChange === null ? "chart.label" : "chart.labelWithChange"),
							{
								series: seriesLabel,
								day: formatDay(lastPoint.day),
								count: number.format(lastPoint.current),
								change: lastChange === null ? "" : percent.format(lastChange),
							},
						)
					: seriesLabel
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
				{/* Time runs from right to left in Arabic, so the values move to the right side. */}
				<XAxis
					dataKey="day"
					reversed={isRtl}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					tickFormatter={formatDay}
				/>
				{/* SVG anchors follow the page direction. "end" puts the text end at the plot side in LTR and RTL. */}
				<YAxis
					hide={!showYAxis}
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					allowDecimals={false}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(label) => formatDay(String(label))}
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
