// The bar chart of the 7-day report: the conversions of each of the last 7 days, with weekday ticks.
// ConversionsReportCard loads this file with React.lazy, so the chart library stays out of the first script.
// The bars fill with a gradient from chart-2 at the top to chart-1 at the base.
import { useId } from "react";
import { Bar, BarChart, XAxis } from "recharts";
import { dayToDate } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { WeekDay } from "../api/overview.queries";

type ConversionsWeekBarsProps = {
	/** The 7 days, oldest first. */
	days: WeekDay[];
};

/** The aria-label names each day and its count, so the chart reads without the tooltip. */
export function ConversionsWeekBars({ days }: ConversionsWeekBarsProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const number = new Intl.NumberFormat(locale);
	// dayToDate gives midnight UTC, so the weekday reads in UTC in every time zone.
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const config = {
		conversions: { label: t("metrics.conversions"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-60 w-full"
			role="img"
			aria-label={`${t("overview.reportTitle")}: ${days
				.map(
					(day) =>
						`${weekday.format(dayToDate(day.day))} ${number.format(day.conversions)}`,
				)
				.join(", ")}`}
		>
			<BarChart data={days} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
				<defs>
					<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--chart-2)" />
						<stop offset="95%" stopColor="var(--chart-1)" />
					</linearGradient>
				</defs>
				{/* Time runs from right to left in Arabic. */}
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					reversed={dir === "rtl"}
					tickFormatter={(day: string) => weekday.format(dayToDate(day))}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => weekday.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Bar
					dataKey="conversions"
					fill={`url(#${fillId})`}
					radius={6}
					maxBarSize={52}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
