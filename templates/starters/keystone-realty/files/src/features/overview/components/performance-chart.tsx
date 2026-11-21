// The area chart of the performance card: new leads as a filled area, viewings as a plain line.
// PerformanceCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// The area has a gradient from 0.3 to 0 opacity. The grid has no vertical lines, and the Y ticks are compact.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { PerformancePoint, PerformanceScale } from "../lib/series";

type PerformanceChartProps = {
	points: PerformancePoint[];
	/** The scale of the points. It picks the tick text: a day, the first day of a week, or a month. */
	scale: PerformanceScale;
};

// A YYYY-MM-DD day as a local date at noon, so no time zone moves it to the day before.
function dateOf(day: string): Date {
	return new Date(`${day}T12:00:00`);
}

/** role="img" with the totals in its label: the tooltip is not the only way to read the values. */
export function PerformanceChart({ points, scale }: PerformanceChartProps) {
	const { t, locale, dir } = useT();
	const gradientId = useId();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const monthFormat = new Intl.DateTimeFormat(locale, { month: "short" });
	const chartConfig = {
		leads: { label: t("overview.performance.leads"), color: "var(--primary)" },
		viewings: {
			label: t("overview.performance.viewings"),
			color: "var(--muted-foreground)",
		},
	} satisfies ChartConfig;
	const totalLeads = points.reduce((sum, point) => sum + point.leads, 0);
	const totalViewings = points.reduce((sum, point) => sum + point.viewings, 0);
	const tickOf = (point: PerformancePoint) =>
		scale === "month"
			? monthFormat.format(dateOf(point.end))
			: dayFormat.format(dateOf(point.start));
	const data = points.map((point) => ({
		...point,
		tick: tickOf(point),
		range:
			point.start === point.end
				? dayFormat.format(dateOf(point.start))
				: dayFormat.formatRange(dateOf(point.start), dateOf(point.end)),
	}));
	// The tooltip gets only the tick text. Each tick is unique on one scale, so it finds its date range.
	const rangeOfTick = new Map(data.map((point) => [point.tick, point.range]));

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-60 w-full"
			role="img"
			aria-label={`${chartConfig.leads.label} ${number.format(totalLeads)}, ${chartConfig.viewings.label} ${number.format(totalViewings)}`}
		>
			<AreaChart data={data} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="5%"
							stopColor="var(--color-leads)"
							stopOpacity={0.3}
						/>
						<stop offset="95%" stopColor="var(--color-leads)" stopOpacity={0} />
					</linearGradient>
				</defs>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="tick"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={16}
					reversed={dir === "rtl"}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					width={32}
					allowDecimals={false}
					orientation={dir === "rtl" ? "right" : "left"}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={(tick) => rangeOfTick.get(String(tick)) ?? tick}
						/>
					}
				/>
				<Area
					type="monotone"
					dataKey="viewings"
					stroke="var(--color-viewings)"
					strokeWidth={2}
					fill="transparent"
					dot={false}
					isAnimationActive={false}
				/>
				<Area
					type="monotone"
					dataKey="leads"
					stroke="var(--color-leads)"
					strokeWidth={2}
					fill={`url(#${gradientId})`}
					dot={false}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
