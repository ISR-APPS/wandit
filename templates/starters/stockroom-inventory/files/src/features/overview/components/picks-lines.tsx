// The two lines of the picks card: the average units picked per day of each week, and the same days one period earlier as a faint line.
// Picks follow the week (few on Saturday, none on Sunday), so a daily line is a zigzag. Weekly averages give a calm line, as in the kit.
// PicksCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "~/features/stock";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

// One group per week. A period under two weeks stays daily: one week gives too few points.
const WEEK_DAYS = 7;

type PicksLinesProps = {
	/** One point per full day of the period, oldest first. */
	points: DailyPoint[];
};

/** One point of the chart: the average picks per day of a few days. */
type PicksGroup = {
	/** YYYY-MM-DD of the first day of the group. */
	firstDay: string;
	/** YYYY-MM-DD of the last day of the group. The axis label shows it. */
	lastDay: string;
	/** Average units picked per day in the group, rounded. */
	current: number;
	/** Average units picked per day on the same days one period earlier, rounded. */
	previous: number;
};

// Weeks end on the last day of the period. The days that do not fill a week join the first, oldest group.
// An average per day, not a sum, keeps that longer first group comparable with the others.
function groupPoints(points: DailyPoint[]): PicksGroup[] {
	const groupDays = points.length < 2 * WEEK_DAYS ? 1 : WEEK_DAYS;
	const groups: PicksGroup[] = [];
	let start = 0;
	while (start < points.length) {
		const size =
			start === 0 ? groupDays + (points.length % groupDays) : groupDays;
		const days = points.slice(start, start + size);
		start += size;
		const first = days[0];
		const last = days.at(-1);
		if (!first || !last) {
			continue;
		}
		groups.push({
			firstDay: first.day,
			lastDay: last.day,
			current: Math.round(
				days.reduce((sum, point) => sum + point.current, 0) / days.length,
			),
			previous: Math.round(
				days.reduce((sum, point) => sum + point.previous, 0) / days.length,
			),
		});
	}
	return groups;
}

/** No visible Y axis: the total in the card head gives the size, and the tooltip gives the average of each group. */
export function PicksLines({ points }: PicksLinesProps) {
	const { t, locale, dir } = useT();
	const number = new Intl.NumberFormat(locale);
	// Midnight UTC, shown in UTC, keeps the same calendar day in every time zone.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string | number) =>
		dayFormat.format(new Date(`${day}T00:00:00Z`));
	const groups = groupPoints(points);
	// The tooltip title of each point, by its last day: the day, or the first and last day of a group.
	const rangeByLastDay = new Map(
		groups.map((group) => [
			group.lastDay,
			group.firstDay === group.lastDay
				? formatDay(group.lastDay)
				: `${formatDay(group.firstDay)} – ${formatDay(group.lastDay)}`,
		]),
	);
	const config = {
		current: { label: t("overview.picksPerDay"), color: "var(--chart-1)" },
		previous: { label: t("overview.periodBefore"), color: "var(--chart-2)" },
	} satisfies ChartConfig;
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const peak = Math.max(0, ...points.map((point) => point.current));

	return (
		<ChartContainer
			config={config}
			role="img"
			aria-label={`${t("overview.picksTitle")}: ${number.format(total)}. ${t("overview.bestDay")}: ${number.format(peak)}`}
			className="aspect-auto h-64 w-full"
		>
			<LineChart data={groups} margin={{ left: 12, right: 12, top: 8 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="lastDay"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					reversed={dir === "rtl"}
					tickFormatter={formatDay}
				/>
				{/* Hidden axis. The range hugs the data with some space, so a change of a few units per day stays visible. */}
				<YAxis
					hide
					domain={[
						(lowest: number) => Math.max(0, Math.floor(lowest * 0.8)),
						(highest: number) => Math.ceil(highest * 1.1),
					]}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(label) =>
								rangeByLastDay.get(String(label)) ?? label
							}
						/>
					}
				/>
				<ChartLegend content={<ChartLegendContent />} />
				{/* The period before is a faint line, so the eye reads the current period first. */}
				<Line
					dataKey="previous"
					type="monotone"
					stroke="var(--color-previous)"
					strokeOpacity={0.4}
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
				<Line
					dataKey="current"
					type="monotone"
					stroke="var(--color-current)"
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}
