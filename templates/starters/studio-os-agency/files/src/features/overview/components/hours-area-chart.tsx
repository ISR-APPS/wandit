// The stacked area chart of the hours card: billable and studio hours of the whole studio per day.
// HoursOverviewCard loads this file with React.lazy, so the chart library stays out of the first script.
// The series has only workdays, so the curve follows the work and does not drop each weekend.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useFormatters } from "~/features/studio";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { HoursPoint } from "../lib/overview-data";

type HoursAreaChartProps = {
	/** One point per workday, oldest first, already cut to the chosen window. */
	points: HoursPoint[];
	/** The text of the aria-label, with the totals of the window. */
	label: string;
};

/** Two stacked areas with a fade, a compact Y axis, and a tooltip with both values of the day. */
export function HoursAreaChart({ points, label }: HoursAreaChartProps) {
	const { t, dir } = useT();
	const { shortDate, number } = useFormatters();
	const id = useId();
	const chartConfig = {
		billable: { label: t("overview.hours.billable"), color: "var(--chart-1)" },
		studio: { label: t("overview.hours.studio"), color: "var(--chart-2)" },
	} satisfies ChartConfig;
	const isRtl = dir === "rtl";

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto @4xl/main:h-64 h-52 w-full"
			role="img"
			aria-label={label}
		>
			<AreaChart data={points} margin={{ top: 8, left: 0, right: 0 }}>
				<defs>
					{(["billable", "studio"] as const).map((key) => (
						<linearGradient
							key={key}
							id={`${id}-${key}`}
							x1="0"
							y1="0"
							x2="0"
							y2="1"
						>
							<stop
								offset="5%"
								stopColor={`var(--color-${key})`}
								stopOpacity={0.3}
							/>
							<stop
								offset="95%"
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
					tickFormatter={(day: string) => shortDate(day)}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					width={32}
					orientation={isRtl ? "right" : "left"}
					tickFormatter={(value: number) => number(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="dot"
							labelFormatter={(label) =>
								typeof label === "string" ? shortDate(label) : label
							}
						/>
					}
				/>
				<Area
					dataKey="studio"
					type="monotone"
					stackId="hours"
					stroke="var(--color-studio)"
					fill={`url(#${id}-studio)`}
					isAnimationActive={false}
				/>
				<Area
					dataKey="billable"
					type="monotone"
					stackId="hours"
					stroke="var(--color-billable)"
					fill={`url(#${id}-billable)`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
