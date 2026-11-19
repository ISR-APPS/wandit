// The grouped bars of the stock in and out card: received units and picked units per bucket of days.
// FlowCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { Bar, BarChart, XAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import type { FlowBucket } from "../api/overview.queries";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = { none: 0, sm: 3, md: 4, lg: 6, xl: 8 } satisfies Record<
	AppThemeFile["selection"]["radius"],
	number
>;

type FlowBarsProps = {
	/** Oldest first. */
	flow: FlowBucket[];
};

/** No Y axis: the totals box of the card gives the size. The tooltip gives each value. */
export function FlowBars({ flow }: FlowBarsProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const number = new Intl.NumberFormat(locale);
	// Midnight UTC, shown in UTC, keeps the same calendar day in every time zone.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) =>
		dayFormat.format(new Date(`${day}T00:00:00Z`));
	// The tooltip title of each bar group, by its last day: the day, or the first and last day of a longer bucket.
	const rangeByLastDay = new Map(
		flow.map((bucket) => [
			bucket.lastDay,
			bucket.firstDay === bucket.lastDay
				? formatDay(bucket.lastDay)
				: `${formatDay(bucket.firstDay)} – ${formatDay(bucket.lastDay)}`,
		]),
	);
	const config = {
		unitsIn: { label: t("overview.unitsIn"), color: "var(--chart-1)" },
		unitsOut: { label: t("overview.unitsOut"), color: "var(--chart-2)" },
	} satisfies ChartConfig;
	const totalIn = flow.reduce((sum, bucket) => sum + bucket.unitsIn, 0);
	const totalOut = flow.reduce((sum, bucket) => sum + bucket.unitsOut, 0);

	return (
		<ChartContainer
			config={config}
			role="img"
			aria-label={`${t("overview.flowTitle")}: ${t("overview.unitsIn")} ${number.format(totalIn)}, ${t("overview.unitsOut")} ${number.format(totalOut)}`}
			className="aspect-auto h-64 w-full"
		>
			<BarChart data={flow} margin={{ left: 0, right: 0 }} barGap={4}>
				<XAxis
					dataKey="lastDay"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					reversed={dir === "rtl"}
					tickFormatter={formatDay}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="dashed"
							labelFormatter={(label) =>
								rangeByLastDay.get(String(label)) ?? label
							}
						/>
					}
				/>
				<Bar
					dataKey="unitsIn"
					fill="var(--color-unitsIn)"
					radius={barRadius}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="unitsOut"
					fill="var(--color-unitsOut)"
					radius={barRadius}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
