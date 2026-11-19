// The stacked area chart of the work card: features and fixes done per working day.
// WorkChartCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.2 of the kit system: two gradient areas, a horizontal grid, and date ticks.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { dayToDate } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { WorkPoint } from "../lib/overview-data";

type WorkAreaChartProps = {
	points: WorkPoint[];
	/** The accessible summary of the chart, with the totals of both series. */
	label: string;
};

/** Features on top of fixes, so the top edge is the total of the day. */
export function WorkAreaChart({ points, label }: WorkAreaChartProps) {
	const { t, locale, dir } = useT();
	const gradientId = useId();
	const chartConfig = {
		features: { label: t("overview.features"), color: "var(--chart-1)" },
		fixes: { label: t("overview.fixes"), color: "var(--chart-2)" },
	} satisfies ChartConfig;
	// The day keys are midnight UTC, so the formats read them in UTC to keep the calendar day.
	const tick = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const isRtl = dir === "rtl";

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto @4xl/main:h-64 h-56 w-full"
			role="img"
			aria-label={label}
		>
			<AreaChart data={points} margin={{ top: 8, right: 8, left: 8 }}>
				<defs>
					{(["features", "fixes"] as const).map((key) => (
						<linearGradient
							key={key}
							id={`${gradientId}-${key}`}
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
					tickFormatter={(day: string) => tick.format(dayToDate(day))}
				/>
				<YAxis
					hide
					orientation={isRtl ? "right" : "left"}
					allowDecimals={false}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="dot"
							// The label is the "day" key of the hovered point.
							labelFormatter={(day) => tick.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Area
					dataKey="fixes"
					type="monotone"
					stackId="work"
					stroke="var(--color-fixes)"
					fill={`url(#${gradientId}-fixes)`}
					isAnimationActive={false}
				/>
				<Area
					dataKey="features"
					type="monotone"
					stackId="work"
					stroke="var(--color-features)"
					fill={`url(#${gradientId}-features)`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
