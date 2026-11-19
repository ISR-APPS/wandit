// The stacked bars of the sign-up weeks card: per week, the teammate invites under the self-serve sign-ups.
// SignUpWeeksCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { Bar, BarChart, XAxis } from "recharts";
import { dayToDate } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { SignUpWeek } from "../api/overview.queries";

type SignUpWeekBarsProps = {
	/** The weeks, the oldest first. */
	weeks: SignUpWeek[];
};

/** The X axis names the first day of each week. The screen reader text gives each week and its two counts. */
export function SignUpWeekBars({ weeks }: SignUpWeekBarsProps) {
	const { t, locale, dir } = useT();
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	const chartConfig = {
		invited: { label: t("overview.signUps.invited"), color: "var(--chart-1)" },
		selfServe: {
			label: t("overview.signUps.selfServe"),
			color: "var(--chart-2)",
		},
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-21/9 w-full"
			role="img"
			aria-label={weeks
				.map(
					(week) =>
						`${formatDay(week.day)}: ${t("overview.signUps.invited")} ${number.format(week.invited)}, ${t("overview.signUps.selfServe")} ${number.format(week.selfServe)}`,
				)
				.join("; ")}
		>
			<BarChart data={weeks} margin={{ left: -8, right: -8 }}>
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					tickFormatter={formatDay}
					reversed={dir === "rtl"}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) =>
								t("overview.signUps.weekOf").replace(
									"{day}",
									formatDay(String(day)),
								)
							}
						/>
					}
				/>
				<Bar
					dataKey="invited"
					stackId="weeks"
					fill="var(--color-invited)"
					radius={[0, 0, 5, 5]}
					maxBarSize={50}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="selfServe"
					stackId="weeks"
					fill="var(--color-selfServe)"
					radius={[5, 5, 0, 0]}
					maxBarSize={50}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
