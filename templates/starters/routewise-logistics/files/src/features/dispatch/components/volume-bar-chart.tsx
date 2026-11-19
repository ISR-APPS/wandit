// The bar chart of the volume card: one bar per day for the chosen series, delivered or failed shipments.
// VolumeCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the chart form "bars" of the app-dashboard skill: a horizontal grid, no axis lines, theme bar corners.
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { dayToDate, fillMessage } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import type { VolumePoint, VolumeSeries } from "./volume-card";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

type VolumeBarChartProps = {
	/** One point per day, oldest first, with both series. */
	points: VolumePoint[];
	/** The series that the bars show. The totals box of the card picks it. */
	series: VolumeSeries;
};

/** The aria-label names the series and its total, so the chart is not a picture only. */
export function VolumeBarChart({ points, series }: VolumeBarChartProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	// The same chart colors as the status strip of the track card, so one status has one color on the page.
	const chartConfig = {
		delivered: { label: t("volume.delivered"), color: "var(--chart-1)" },
		failed: { label: t("volume.failed"), color: "var(--chart-4)" },
	} satisfies ChartConfig;
	const total = points.reduce((sum, point) => sum + point[series], 0);

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-48 w-full"
			role="img"
			aria-label={fillMessage(t("volume.chartLabel"), {
				series: chartConfig[series].label,
				total: number.format(total),
			})}
		>
			<BarChart data={points} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={32}
					reversed={dir === "rtl"}
					tickFormatter={(day: string) => dayFormat.format(dayToDate(day))}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Bar
					dataKey={series}
					fill={`var(--color-${series})`}
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
