// The mini trend of the hiring section: one bar per day of the period, with no axis lines and no grid.
// HiringSection loads it lazily with the daily application series, so recharts stays out of the first script.
import { Bar, BarChart, XAxis } from "recharts";
import { type DailyPoint, dayKeyToUtcDate } from "~/features/people";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useBarRadius } from "../hooks/use-bar-radius";

type ApplicationsTrendChartProps = {
	/** Applications per day in the period, oldest first. */
	points: DailyPoint[];
};

/** Default export: React.lazy loads this file. The aria-label names the last day and its count. */
export default function ApplicationsTrendChart({
	points,
}: ApplicationsTrendChartProps) {
	const { t, locale, dir } = useT();
	const barRadius = useBarRadius();
	const number = new Intl.NumberFormat(locale);
	const dateFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const longDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const config = {
		current: {
			label: t("overview.applicationsTitle"),
			color: "var(--chart-2)",
		},
	} satisfies ChartConfig;
	const last = points[points.length - 1];
	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-28 w-full"
			role="img"
			aria-label={
				last
					? `${t("overview.applicationsTitle")}. ${longDate.format(dayKeyToUtcDate(last.day))}: ${number.format(last.current)}`
					: t("overview.applicationsTitle")
			}
		>
			<BarChart data={points} margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					reversed={dir === "rtl"}
					tickFormatter={(day: string) =>
						dateFormat.format(dayKeyToUtcDate(day))
					}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) =>
								longDate.format(dayKeyToUtcDate(String(day)))
							}
						/>
					}
				/>
				<Bar
					dataKey="current"
					fill="var(--color-current)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
