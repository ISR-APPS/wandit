// The small trend of the product dialog: the units of one product sold per day.
// ProductDialog loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the trend part of the chart form "area" of the app-dashboard skill, at a mini height with a date axis.
import { useId } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { type DailyPoint, dayToDate } from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type ProductUnitsChartProps = {
	/** Units sold per day, oldest first. */
	points: DailyPoint[];
	/** The text for screen readers: the total of the period in words. */
	label: string;
};

/** The scale starts at 0, so a day with no sale sits on the base line. */
export function ProductUnitsChart({ points, label }: ProductUnitsChartProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	const chartConfig = {
		current: { label: t("products.unitsSold"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-24 w-full"
			role="img"
			aria-label={label}
		>
			<AreaChart
				data={points}
				margin={{ top: 4, bottom: 0, left: 0, right: 0 }}
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
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={6}
					minTickGap={40}
					reversed={dir === "rtl"}
					tickFormatter={formatDay}
				/>
				<YAxis hide domain={[0, "auto"]} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => formatDay(String(day))}
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
