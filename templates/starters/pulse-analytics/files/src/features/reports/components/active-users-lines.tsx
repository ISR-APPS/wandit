// The two lines of the active users card: the active users per day of the period (strong line),
// and the same day one period earlier (muted line). ActiveUsersCard loads this file with React.lazy.
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { type DailyPoint, dayToDate } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type ActiveUsersLinesProps = {
	/** The active users per day, oldest first, with the same day one period earlier. */
	points: DailyPoint[];
};

/** Hidden from screen readers: the card description gives the change in words. */
export function ActiveUsersLines({ points }: ActiveUsersLinesProps) {
	const { t, locale, dir } = useT();
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const chartConfig = {
		previous: {
			label: t("reports.activeUsers.previous"),
			color: "var(--muted-foreground)",
		},
		current: {
			label: t("reports.activeUsers.current"),
			color: "var(--primary)",
		},
	} satisfies ChartConfig;
	const values = points.flatMap((point) => [point.current, point.previous]);
	const lowest = Math.min(...values);
	const highest = Math.max(...values);
	// The floor is half a spread under the lowest day. The lines fill the card, and the weekday to weekend drop stays calm.
	const floor =
		values.length === 0 ? 0 : Math.max(0, lowest - (highest - lowest) / 2);

	return (
		<ChartContainer
			config={chartConfig}
			aria-hidden="true"
			// flex-1 fills the card, which the notes card beside it makes tall. The minimum keeps a phone readable.
			className="aspect-auto @2xl/main:min-h-62 min-h-32 w-full flex-1"
		>
			<LineChart
				data={points}
				margin={{ top: 5, right: 10, bottom: 0, left: 10 }}
			>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<YAxis hide domain={[floor, "auto"]} />
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				<ChartLegend content={<ChartLegendContent />} />
				{/* "monotone" goes through each day, so the hover dot and the tooltip value sit on the line. */}
				<Line
					dataKey="previous"
					type="monotone"
					stroke="var(--color-previous)"
					strokeOpacity={0.5}
					strokeWidth={2}
					dot={false}
					activeDot={{ r: 6, fill: "var(--color-previous)" }}
					isAnimationActive={false}
				/>
				<Line
					dataKey="current"
					type="monotone"
					stroke="var(--color-current)"
					strokeWidth={2}
					dot={false}
					activeDot={{ r: 8, fill: "var(--color-current)" }}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}
