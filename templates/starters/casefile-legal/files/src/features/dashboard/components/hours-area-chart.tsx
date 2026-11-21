// The area chart of the hours card: billable and non-billable hours per day, stacked, as a 7-day average.
// HoursOverviewCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.2 of the kit system: monotone areas with a gradient fill, a grid, and date ticks.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { dayToDate, fillMessage, hoursFormat } from "~/features/practice";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { HoursSeries } from "../lib/dashboard";

type HoursAreaChartProps = {
	/** Smoothed points of the period and its real hour totals, from hoursPerDay. */
	series: HoursSeries;
};

/** The aria-label names the real totals of both series, so the chart is not a picture only. */
export function HoursAreaChart({ series }: HoursAreaChartProps) {
	const { t, locale, dir } = useT();
	const billableId = useId();
	const otherId = useId();
	const hours = hoursFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const isRtl = dir === "rtl";
	const chartConfig = {
		billable: { label: t("dashboard.billable"), color: "var(--chart-1)" },
		nonBillable: { label: t("dashboard.nonBillable"), color: "var(--chart-3)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-72 w-full"
			role="img"
			aria-label={fillMessage(t("dashboard.hoursChartLabel"), {
				billable: hours.format(series.billableTotal),
				nonBillable: hours.format(series.nonBillableTotal),
			})}
		>
			<AreaChart
				data={series.points}
				// The margin on the axis side keeps the ticks off the edge of the plot.
				margin={{
					top: 8,
					bottom: 0,
					left: isRtl ? 0 : 4,
					right: isRtl ? 4 : 0,
				}}
			>
				<defs>
					{[
						{ id: billableId, key: "billable" },
						{ id: otherId, key: "nonBillable" },
					].map((gradient) => (
						<linearGradient
							key={gradient.key}
							id={gradient.id}
							x1="0"
							y1="0"
							x2="0"
							y2="1"
						>
							<stop
								offset="0%"
								stopColor={`var(--color-${gradient.key})`}
								stopOpacity={0.3}
							/>
							<stop
								offset="100%"
								stopColor={`var(--color-${gradient.key})`}
								stopOpacity={0}
							/>
						</linearGradient>
					))}
				</defs>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={32}
					reversed={isRtl}
					tickFormatter={(day: string) => dayFormat.format(dayToDate(day))}
				/>
				<YAxis
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					allowDecimals={false}
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Area
					dataKey="nonBillable"
					type="monotone"
					stackId="hours"
					stroke="var(--color-nonBillable)"
					fill={`url(#${otherId})`}
					isAnimationActive={false}
				/>
				<Area
					dataKey="billable"
					type="monotone"
					stackId="hours"
					stroke="var(--color-billable)"
					fill={`url(#${billableId})`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
