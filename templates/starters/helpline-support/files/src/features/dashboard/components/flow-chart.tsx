// The area chart of the flow card: the tickets created and the tickets solved on each day of the period.
// FlowCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.2 of the kit system: monotone lines, gradient fills, a horizontal grid, no Y axis on a side card.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { dayToDate } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { FlowPoint } from "../api/dashboard.queries";

/** The series of the chart. The tabs of FlowCard pick one or both. */
export type FlowSeries = "created" | "solved";

type FlowChartProps = {
	/** One point per day, oldest first. */
	points: FlowPoint[];
	/** The series to draw. */
	series: FlowSeries[];
	/** The text of the aria-label: the totals of the period in words. */
	label: string;
};

/** Created takes the chart series 1, solved takes series 2, as in the legend of the card. */
export function FlowChart({ points, series, label }: FlowChartProps) {
	const { t, locale, dir } = useT();
	const gradientId = useId();
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const isRtl = dir === "rtl";
	const chartConfig = {
		created: { label: t("dashboard.created"), color: "var(--chart-1)" },
		solved: { label: t("dashboard.solved"), color: "var(--chart-2)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-56 w-full"
			role="img"
			aria-label={label}
		>
			<AreaChart
				data={points}
				margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
			>
				<defs>
					{series.map((key) => (
						<linearGradient
							key={key}
							id={`${gradientId}-${key}`}
							x1="0"
							y1="0"
							x2="0"
							y2="1"
						>
							<stop
								offset="0%"
								stopColor={`var(--color-${key})`}
								stopOpacity={0.3}
							/>
							<stop
								offset="100%"
								stopColor={`var(--color-${key})`}
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
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				{series.map((key) => (
					<Area
						key={key}
						dataKey={key}
						type="monotone"
						stroke={`var(--color-${key})`}
						fill={`url(#${gradientId}-${key})`}
						isAnimationActive={false}
					/>
				))}
			</AreaChart>
		</ChartContainer>
	);
}
