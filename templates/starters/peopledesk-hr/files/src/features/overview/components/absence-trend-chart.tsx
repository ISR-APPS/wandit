// The stacked bar chart of days off: one bar per day, one segment per time-off type, vacation at the bottom.
// AbsenceSection of the overview loads it lazily and renders it at side height. It takes translated category points.
// The series colors follow TIME_OFF_TYPE_COLOR, so the legend and the planner use the same colors.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	type CategoryPoint,
	dayKeyToUtcDate,
	TIME_OFF_TYPE_COLOR,
	TIME_OFF_TYPES,
	type TimeOffType,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useBarRadius } from "../hooks/use-bar-radius";

/** One bar: the day, then one value per series key s0 to s4 (CSS-safe keys for ChartConfig). */
type StackRow = { day: string; [series: `s${number}`]: number };

type AbsenceTrendChartProps = {
	/** Person-days off per day and type, oldest first, with every type on every day. */
	points: CategoryPoint<TimeOffType>[];
};

/** The plot only. The section around it draws the title, the total, and the legend. Default export: React.lazy loads this file. */
export default function AbsenceTrendChart({ points }: AbsenceTrendChartProps) {
	const { t, locale, dir } = useT();
	const barRadius = useBarRadius();
	const isRtl = dir === "rtl";

	const rowsByDay = new Map<string, StackRow>();
	for (const point of points) {
		const row = rowsByDay.get(point.day) ?? { day: point.day };
		const key = `s${TIME_OFF_TYPES.indexOf(point.category)}` as const;
		row[key] = (row[key] ?? 0) + point.value;
		rowsByDay.set(point.day, row);
	}
	const rows = [...rowsByDay.values()];
	const config = Object.fromEntries(
		TIME_OFF_TYPES.map((type, index) => [
			`s${index}`,
			{ label: t(`timeOffTypes.${type}`), color: TIME_OFF_TYPE_COLOR[type] },
		]),
	) satisfies ChartConfig;
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
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const lastRow = rows[rows.length - 1];
	const lastTotal = lastRow
		? TIME_OFF_TYPES.reduce(
				(sum, _type, index) => sum + (lastRow[`s${index}`] ?? 0),
				0,
			)
		: 0;
	const label = lastRow
		? `${t("overview.daysOffTitle")}. ${longDate.format(dayKeyToUtcDate(lastRow.day))}: ${number.format(lastTotal)}`
		: t("overview.daysOffTitle");

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-52 w-full"
			role="img"
			aria-label={label}
		>
			<BarChart data={rows} margin={{ top: 4, left: 0, right: 0 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					reversed={isRtl}
					tickFormatter={(day: string) =>
						dateFormat.format(dayKeyToUtcDate(day))
					}
				/>
				<YAxis
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					allowDecimals={false}
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
					tickFormatter={(value: number) => compact.format(value)}
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
				{TIME_OFF_TYPES.map((type, index) => (
					<Bar
						key={type}
						dataKey={`s${index}`}
						stackId="day"
						fill={`var(--color-s${index})`}
						isAnimationActive={false}
						// Only the top segment gets round corners.
						radius={
							index === TIME_OFF_TYPES.length - 1
								? [barRadius, barRadius, 0, 0]
								: 0
						}
					/>
				))}
			</BarChart>
		</ChartContainer>
	);
}
