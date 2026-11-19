// The area chart of the lessons card: the lessons that students finished each full day of the period.
// LessonsTrendCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// As in the kit card, the area runs to the card edges and has no axis; the tooltip names the day and the count.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { type DailyPoint, dayToDate, fillMessage } from "~/features/school";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type LessonsAreaChartProps = {
	/** One point per day, oldest first. `current` is the plotted value; `previous` is not drawn. */
	points: DailyPoint[];
};

/** The aria-label names the last day and its value, so the chart is not a picture only. */
export function LessonsAreaChart({ points }: LessonsAreaChartProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const lastPoint = points.at(-1);
	const chartConfig = {
		current: { label: t("dashboard.lessonsTitle"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto @4xl/main:h-104 h-72 w-full"
			role="img"
			aria-label={
				lastPoint
					? fillMessage(t("dashboard.lessonsLabel"), {
							day: dayFormat.format(dayToDate(lastPoint.day)),
							count: number.format(lastPoint.current),
						})
					: t("dashboard.lessonsTitle")
			}
		>
			<AreaChart
				data={points}
				margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
			>
				<defs>
					<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0%"
							stopColor="var(--color-current)"
							stopOpacity={0.5}
						/>
						<stop
							offset="100%"
							stopColor="var(--color-current)"
							stopOpacity={0.05}
						/>
					</linearGradient>
				</defs>
				<CartesianGrid vertical={false} />
				{/* Hidden: it only gives the tooltip its day. Arabic reads the days from the right. */}
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				{/* basis: the daily counts jump with the weekday. A B-spline draws a calm curve, as the kit chart. */}
				<Area
					dataKey="current"
					type="basis"
					stroke="var(--color-current)"
					strokeWidth={2}
					fill={`url(#${fillId})`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
