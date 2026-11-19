// The line chart of the occupancy card: the booked rooms and the available rooms of each night of one week.
// OccupancyCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { dayToDate } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { OccupancyPoint } from "../lib/home-figures";

type OccupancyChartProps = {
	/** The 7 nights of the week, Monday first. */
	points: OccupancyPoint[];
	/** The text of the chart for a screen reader: the week and its sums. */
	label: string;
};

/** Two lines, a tooltip per night, and a count axis at the start side. Arabic mirrors the axes. */
export function OccupancyChart({ points, label }: OccupancyChartProps) {
	const { t, locale, dir } = useT();
	const dayName = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
	});
	const chartConfig = {
		booked: { label: t("frontDesk.occupancy.booked"), color: "var(--chart-1)" },
		available: {
			label: t("frontDesk.occupancy.available"),
			color: "var(--chart-4)",
		},
	} satisfies ChartConfig;
	const isRtl = dir === "rtl";

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-52 w-full"
			role="img"
			aria-label={label}
		>
			<LineChart
				data={points}
				margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
			>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					reversed={isRtl}
					tickFormatter={(day: string) => dayName.format(dayToDate(day))}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					width={28}
					allowDecimals={false}
					orientation={isRtl ? "right" : "left"}
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={(day) =>
								typeof day === "string" ? dayName.format(dayToDate(day)) : day
							}
						/>
					}
				/>
				<Line
					type="monotone"
					dataKey="booked"
					stroke="var(--color-booked)"
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
				<Line
					type="monotone"
					dataKey="available"
					stroke="var(--color-available)"
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}
