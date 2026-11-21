// The line chart of the revenue trend card: the revenue of the period, and a faint line of the period before.
// RevenueTrendCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the compare form of the app-dashboard skill: the previous period is a second, lighter line with a legend.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { CURRENCY, type DailyPoint, dayToDate } from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

// The line of the period before stays visible but steps back behind the current one.
const PREVIOUS_LINE_OPACITY = 0.35;

// The kit line has about 10 points. More daily points draw tall spikes, because one day of a shop is noisy.
const TARGET_STEP_COUNT = 10;

/** Some days of the period summed into one point of the line. */
type RevenueStep = DailyPoint & {
	/** The last day of the step, YYYY-MM-DD. Equal to `day` when the step holds one day. */
	lastDay: string;
};

// 7 days stay daily, 30 days give 10 steps of 3 days, 90 days give 10 steps of 9 days.
// The oldest step holds fewer days when the period does not divide evenly. Its tooltip names its days.
function stepsOf(points: DailyPoint[]): RevenueStep[] {
	const size = Math.max(1, Math.round(points.length / TARGET_STEP_COUNT));
	const steps: RevenueStep[] = [];
	for (let end = points.length; end > 0; end -= size) {
		const group = points.slice(Math.max(0, end - size), end);
		const first = group[0];
		const last = group.at(-1);
		if (!first || !last) {
			continue;
		}
		steps.unshift({
			day: first.day,
			lastDay: last.day,
			current: group.reduce((sum, point) => sum + point.current, 0),
			previous: group.reduce((sum, point) => sum + point.previous, 0),
		});
	}
	return steps;
}

type RevenueTrendChartProps = {
	/** One point per day of the period, oldest first, with the same day one period earlier. */
	points: DailyPoint[];
};

/** The aria-label names the last step and its amount. The tooltip shows the days of each step. */
export function RevenueTrendChart({ points }: RevenueTrendChartProps) {
	const { t, locale, dir } = useT();
	const config = {
		current: { label: t("overview.trend.current"), color: "var(--chart-1)" },
		previous: { label: t("overview.trend.previous"), color: "var(--chart-2)" },
	} satisfies ChartConfig;
	// `day` is YYYY-MM-DD with no time. Midnight UTC, shown in UTC, keeps the same calendar day.
	const tickDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const money = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		maximumFractionDigits: 0,
	});
	const steps = stepsOf(points);
	const lastDayOf = new Map(steps.map((step) => [step.day, step.lastDay]));
	// One day shows "Nov 16". A step of 3 days shows "Nov 14 – 16".
	const stepText = (day: string) =>
		tickDate.formatRange(dayToDate(day), dayToDate(lastDayOf.get(day) ?? day));
	const last = steps.at(-1);

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-64 w-full"
			role="img"
			aria-label={
				last
					? `${t("overview.trend.title")}. ${stepText(last.day)}: ${money.format(last.current)}.`
					: t("overview.trend.title")
			}
		>
			<LineChart data={steps} margin={{ left: 12, right: 12 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					reversed={dir === "rtl"}
					tickFormatter={(day: string) => tickDate.format(dayToDate(day))}
				/>
				{/* A zero floor keeps a small change from looking like a fall. */}
				<YAxis hide domain={[0, "auto"]} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(day) => stepText(String(day))}
							valueFormat={{
								style: "currency",
								currency: CURRENCY,
								maximumFractionDigits: 0,
							}}
						/>
					}
				/>
				<Line
					dataKey="current"
					type="linear"
					stroke="var(--color-current)"
					dot={false}
					isAnimationActive={false}
				/>
				<Line
					dataKey="previous"
					type="linear"
					stroke="var(--color-previous)"
					strokeOpacity={PREVIOUS_LINE_OPACITY}
					dot={false}
					isAnimationActive={false}
				/>
				<ChartLegend content={<ChartLegendContent />} />
			</LineChart>
		</ChartContainer>
	);
}
