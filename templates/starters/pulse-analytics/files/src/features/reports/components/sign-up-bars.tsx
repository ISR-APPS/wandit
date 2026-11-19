// The bar chart of the sign-ups card: the sign-ups of each week, with the count on top of each bar.
// SignUpsCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { Bar, BarChart, LabelList, XAxis } from "recharts";
import { dayToDate, fillMessage } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { WeekCount } from "../api/reports.queries";

type SignUpBarsProps = {
	/** The weeks, the oldest first. */
	weeks: WeekCount[];
};

/** The X axis is hidden: the labels give each count, the tooltip gives the week. */
export function SignUpBars({ weeks }: SignUpBarsProps) {
	const { t, locale, dir } = useT();
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	const chartConfig = {
		count: { label: t("reports.signUps.title"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-25 w-full"
			role="img"
			aria-label={`${t("reports.signUps.title")}: ${weeks
				.map((week) => `${formatDay(week.day)} ${number.format(week.count)}`)
				.join(", ")}`}
		>
			<BarChart data={weeks} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) =>
								fillMessage(t("reports.signUps.weekOf"), {
									day: formatDay(String(day)),
								})
							}
						/>
					}
				/>
				<Bar
					dataKey="count"
					fill="var(--color-count)"
					radius={4}
					isAnimationActive={false}
				>
					<LabelList
						position="top"
						offset={8}
						className="fill-foreground"
						fontSize={12}
					/>
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
