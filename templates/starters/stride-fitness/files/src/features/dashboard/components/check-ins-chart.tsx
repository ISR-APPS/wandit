// The area chart of the check-ins card: this period as a filled area, the period before as a plain line.
// CheckInsCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.2 of the kit system: a monotone curve, a gradient fill, a horizontal grid, and compact ticks.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { CheckInPoint } from "../lib/summary";

type CheckInsChartProps = {
	/** One point per day (`key` is `YYYY-MM-DD`) or per hour (`key` is "6" to "21"), oldest first. */
	points: CheckInPoint[];
	/** "daily" reads `key` as a day, "hourly" as an hour of the day. */
	mode: "daily" | "hourly";
	/** The text of the chart for screen readers: the totals that the chart draws. */
	label: string;
};

// A day key `YYYY-MM-DD` as a local date. Without a zone, the parser reads a date-time as local time.
function dayOf(key: string): Date {
	return new Date(`${key}T00:00`);
}

// An hour of today as a date, so Intl formats it in the clock style of the language: "6 AM" or "06".
function hourOf(key: string): Date {
	return new Date(new Date().setHours(Number(key), 0, 0, 0));
}

/** The tooltip shows both series of the point under the pointer. */
export function CheckInsChart({ points, mode, label }: CheckInsChartProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const hourFormat = new Intl.DateTimeFormat(locale, { hour: "numeric" });
	const formatKey = (key: string) =>
		mode === "daily"
			? dayFormat.format(dayOf(key))
			: hourFormat.format(hourOf(key));
	const isRtl = dir === "rtl";
	const chartConfig = {
		current: { label: t("dashboard.thisPeriod"), color: "var(--chart-1)" },
		previous: { label: t("dashboard.previousPeriod"), color: "var(--chart-2)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-72 w-full"
			role="img"
			aria-label={label}
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
					dataKey="key"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					reversed={isRtl}
					tickFormatter={formatKey}
				/>
				<YAxis
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					allowDecimals={mode === "hourly"}
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(key) => formatKey(String(key))}
						/>
					}
				/>
				<Area
					dataKey="previous"
					type="monotone"
					stroke="var(--color-previous)"
					strokeDasharray="4 4"
					fill="none"
					isAnimationActive={false}
				/>
				<Area
					dataKey="current"
					type="monotone"
					stroke="var(--color-current)"
					strokeWidth={2}
					fill={`url(#${fillId})`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
