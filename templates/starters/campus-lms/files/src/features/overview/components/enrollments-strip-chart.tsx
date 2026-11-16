// The mini trend of the "bars" chart form: one small bar per day of new enrollments, with no axes.
// The enrollments section of the home renders it. The tooltip and the aria-label give the values.
// It reads the bar corner of the live theme with useAppTheme().
import { Bar, BarChart, Cell, XAxis } from "recharts";
import { type DailyPoint, dayToDate } from "~/features/school";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useAppTheme } from "~/styles/theme";
import { BAR_RADIUS_PX, TODAY_FILL_OPACITY } from "../lib/bar-style";

type EnrollmentsStripChartProps = {
	/** One point per local day of the period, oldest first. */
	points: DailyPoint[];
};

/** h-28: the mini height of the digest. The XAxis stays hidden; it only keeps the day order in Arabic. */
export function EnrollmentsStripChart({ points }: EnrollmentsStripChartProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const config = {
		current: { label: t("overview.enrollmentsTitle"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const last = points.at(-1);

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-28 w-full"
			role="img"
			aria-label={
				last
					? `${t("overview.enrollmentsChart")}: ${dayFormat.format(dayToDate(last.day))}, ${new Intl.NumberFormat(locale).format(last.current)}`
					: t("overview.enrollmentsChart")
			}
		>
			<BarChart data={points} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) =>
								String(day) === last?.day
									? t("overview.todaySoFar")
									: dayFormat.format(dayToDate(String(day)))
							}
						/>
					}
				/>
				<Bar
					dataKey="current"
					fill="var(--color-current)"
					radius={[barRadius, barRadius, 0, 0]}
					minPointSize={2}
					isAnimationActive={false}
				>
					{points.map((point, index) => (
						<Cell
							key={point.day}
							fillOpacity={index === points.length - 1 ? TODAY_FILL_OPACITY : 1}
						/>
					))}
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
