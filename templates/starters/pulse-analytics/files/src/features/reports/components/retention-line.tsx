// The line of the retention card: the week 1 retention of each complete sign-up week, the oldest first.
// RetentionCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { dayToDate, fillMessage } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { CohortRetention } from "../api/reports.queries";

type RetentionLineProps = {
	/** The complete cohorts, the oldest first. */
	cohorts: CohortRetention[];
};

/** No axis is visible: the card value gives the figure, the tooltip gives each week. A week with no user leaves a gap. */
export function RetentionLine({ cohorts }: RetentionLineProps) {
	const { t, locale, dir } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	const chartConfig = {
		rate: { label: t("reports.retention.title"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-25 w-full"
			role="img"
			aria-label={`${t("reports.retention.title")}: ${cohorts
				.map(
					(cohort) =>
						`${formatDay(cohort.day)} ${cohort.rate === null ? "–" : percent.format(cohort.rate)}`,
				)
				.join(", ")}`}
		>
			<LineChart
				data={cohorts}
				margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
			>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<YAxis hide domain={["dataMin - 0.05", "dataMax + 0.05"]} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) =>
								fillMessage(t("reports.signUps.weekOf"), {
									day: formatDay(String(day)),
								})
							}
							valueFormat={{ style: "percent", maximumFractionDigits: 0 }}
						/>
					}
				/>
				<Line
					dataKey="rate"
					type="linear"
					stroke="var(--color-rate)"
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}
