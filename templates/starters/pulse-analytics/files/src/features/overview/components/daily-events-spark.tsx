// The edge-to-edge area chart at the bottom of the average daily events card: all events per day.
// DailyEventsCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It has no axis: the card text gives the value. The tooltip gives the day and its count.
import { useId } from "react";
import { Area, AreaChart, XAxis } from "recharts";
import { type DailyPoint, dayToDate } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type DailyEventsSparkProps = {
	/** All events per day, oldest first. */
	points: DailyPoint[];
};

/** Hidden from screen readers: the card value says the same in words. */
export function DailyEventsSpark({ points }: DailyEventsSparkProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const chartConfig = {
		current: { label: t("overview.volume.events"), color: "var(--chart-2)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			aria-hidden="true"
			className="aspect-auto h-24 w-full"
		>
			<AreaChart
				data={points}
				margin={{ top: 5, right: 0, bottom: 0, left: 0 }}
			>
				<defs>
					<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="5%"
							stopColor="var(--color-current)"
							stopOpacity={0.8}
						/>
						<stop
							offset="95%"
							stopColor="var(--color-current)"
							stopOpacity={0.1}
						/>
					</linearGradient>
				</defs>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="dot"
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Area
					dataKey="current"
					type="monotone"
					fill={`url(#${fillId})`}
					stroke="var(--color-current)"
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
