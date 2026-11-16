// The large sparkline of the revenue hero: one point for each day, with a mark on the last full day.
// RevenueHero loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the trend part of the chart form "area" of the app-dashboard skill, at the strip height of the home "hero".
import { useId } from "react";
import { Area, AreaChart, ReferenceDot, XAxis, YAxis } from "recharts";
import {
	CURRENCY,
	type DailyPoint,
	dayToDate,
	fillMessage,
	moneyFormat,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type RevenueChartProps = {
	/** Revenue per day, oldest first. The last point is yesterday. */
	points: DailyPoint[];
};

/** No axis and no grid: the figure beside it gives the total. The tooltip gives the amount of one day. */
export function RevenueChart({ points }: RevenueChartProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const money = moneyFormat(locale, "whole");
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	const chartConfig = {
		current: { label: t("overview.revenue"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const lastPoint = points.at(-1);

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto @4xl/main:h-40 h-28 w-full"
			role="img"
			aria-label={
				lastPoint
					? fillMessage(t("overview.revenueChartLabel"), {
							day: formatDay(lastPoint.day),
							amount: money.format(lastPoint.current),
						})
					: t("overview.revenue")
			}
		>
			<AreaChart
				data={points}
				// The margins keep the mark of the last day inside the plot.
				margin={{ top: 8, bottom: 4, left: 6, right: 6 }}
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
				{/* Time runs from right to left in Arabic. */}
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				{/* The scale starts at 0, so a calm week does not look like a fall. */}
				<YAxis hide domain={[0, "auto"]} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => formatDay(String(day))}
							valueFormat={{
								style: "currency",
								currency: CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				<Area
					dataKey="current"
					// Straight segments: each peak reads as one day, and a smooth curve does not overshoot it.
					type="linear"
					stroke="var(--color-current)"
					strokeWidth={2}
					fill={`url(#${fillId})`}
					isAnimationActive={false}
				/>
				{/* The mark of the last full day. */}
				{lastPoint ? (
					<ReferenceDot
						x={lastPoint.day}
						y={lastPoint.current}
						r={4}
						fill="var(--color-current)"
						stroke="var(--card)"
						strokeWidth={2}
					/>
				) : null}
			</AreaChart>
		</ChartContainer>
	);
}
