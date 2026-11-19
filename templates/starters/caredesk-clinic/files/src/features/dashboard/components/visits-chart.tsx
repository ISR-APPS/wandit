// The line chart of the visits card: the visits of women, men, and children per day (7 days) or per group of days.
// VisitsCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// Three curved lines with dots, a horizontal grid, and a compact Y axis, as the kit visits chart draws them.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { addDays } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import {
	VISIT_GROUP_COLORS,
	VISIT_GROUPS,
	type VisitPoint,
} from "../lib/summary";

type VisitsChartProps = {
	points: VisitPoint[];
	/** The days in one point, from visitBucketDays. Above 1, the tooltip names the first and the last day. */
	bucketDays: number;
};

/** The aria-label gives the totals of each group, so the chart reads without the picture. */
export function VisitsChart({ points, bucketDays }: VisitsChartProps) {
	const { t, locale, dir } = useT();
	const isRtl = dir === "rtl";
	const day = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const number = new Intl.NumberFormat(locale);
	const chartConfig = Object.fromEntries(
		VISIT_GROUPS.map((group) => [
			group,
			{
				label: t(`dashboard.groups.${group}`),
				color: VISIT_GROUP_COLORS[group],
			},
		]),
	) satisfies ChartConfig;
	const totals = VISIT_GROUPS.map(
		(group) =>
			`${t(`dashboard.groups.${group}`)} ${number.format(
				points.reduce((sum, point) => sum + point[group], 0),
			)}`,
	).join(", ");

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto @4xl/main:h-96 h-72 w-full"
			role="img"
			aria-label={`${t("dashboard.visitsTitle")}: ${totals}`}
		>
			<LineChart data={points} margin={{ top: 8, left: 4, right: 8 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="start"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					reversed={isRtl}
					tickFormatter={(value: number) => day.format(value)}
				/>
				<YAxis
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					allowDecimals={false}
					orientation={isRtl ? "right" : "left"}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							// The label is the `start` of the point: local midnight in milliseconds.
							labelFormatter={(label) =>
								bucketDays === 1
									? day.format(Number(label))
									: day.formatRange(
											Number(label),
											addDays(Number(label), bucketDays - 1),
										)
							}
						/>
					}
				/>
				{VISIT_GROUPS.map((group) => (
					<Line
						key={group}
						dataKey={group}
						type="natural"
						stroke={`var(--color-${group})`}
						dot={{ r: 3, fill: "var(--card)" }}
						isAnimationActive={false}
					/>
				))}
			</LineChart>
		</ChartContainer>
	);
}
