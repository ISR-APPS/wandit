// The three charts of the audience page: the new follower bars with values on top, the follower line,
// and the growth lines of the period against the period before. The cards load this file with React.lazy,
// so the chart library stays out of the first script of the app. No chart shows axes, as in the kit cards.
// The follower line starts its axis at the lowest value. The growth lines plot 7-day means with space around them.
import {
	Bar,
	BarChart,
	LabelList,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import { type DailyPoint, dayToDate } from "~/features/social";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

// The day keys are calendar days. UTC keeps the same day in every time zone.
function useDayFormat() {
	const { locale } = useT();
	const format = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	return (day: string) => format.format(dayToDate(day));
}

type GainBarsProps = {
	/** Net new followers per group of days, oldest first. */
	buckets: { start: string; gain: number }[];
	/** The translated series name. */
	seriesLabel: string;
};

/** The value of each bar stands on top of it, as in the kit "subscriptions" card. */
export function GainBars({ buckets, seriesLabel }: GainBarsProps) {
	const { locale, dir } = useT();
	const formatDay = useDayFormat();
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const data = buckets.map((bucket) => ({
		day: formatDay(bucket.start),
		gain: bucket.gain,
	}));
	const chartConfig = {
		gain: { label: seriesLabel, color: "var(--chart-1)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-28 w-full"
			role="img"
			aria-label={`${seriesLabel}: ${data
				.map((point) => `${point.day} ${compact.format(point.gain)}`)
				.join(", ")}`}
		>
			<BarChart data={data} margin={{ top: 20, left: 0, right: 0, bottom: 0 }}>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
				<Bar
					dataKey="gain"
					fill="var(--color-gain)"
					radius={4}
					isAnimationActive={false}
				>
					<LabelList
						dataKey="gain"
						position="top"
						offset={6}
						className="fill-foreground text-xs"
						formatter={(value) =>
							typeof value === "number" ? compact.format(value) : ""
						}
					/>
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}

type FollowersLineProps = {
	points: DailyPoint[];
	seriesLabel: string;
};

/** One line of the followers at the end of each day. It starts near the lowest value, so its shape shows. */
export function FollowersLine({ points, seriesLabel }: FollowersLineProps) {
	const { dir } = useT();
	const formatDay = useDayFormat();
	const chartConfig = {
		current: { label: seriesLabel, color: "var(--chart-2)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-28 w-full"
			aria-hidden="true"
		>
			<LineChart
				data={points}
				margin={{ top: 8, left: 8, right: 8, bottom: 8 }}
			>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				{/* The axis starts at the lowest value, not at 0, so the change of the days shows. */}
				<YAxis hide domain={["dataMin", "dataMax"]} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(label) => formatDay(String(label))}
						/>
					}
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

type GrowthLinesProps = {
	/** The 7-day mean of net new followers per day, oldest first, from AudienceGrowth.gainTrend. */
	points: DailyPoint[];
	/** The translated names of the two lines. */
	currentLabel: string;
	previousLabel: string;
};

/** The period in the first chart color, the period before in the third. */
export function GrowthLines({
	points,
	currentLabel,
	previousLabel,
}: GrowthLinesProps) {
	const { locale, dir } = useT();
	const formatDay = useDayFormat();
	const number = new Intl.NumberFormat(locale);
	const chartConfig = {
		current: { label: currentLabel, color: "var(--chart-1)" },
		previous: { label: previousLabel, color: "var(--chart-3)" },
	} satisfies ChartConfig;
	const last = points.at(-1);
	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-72 w-full"
			role="img"
			aria-label={`${currentLabel} ${number.format(last?.current ?? 0)}, ${previousLabel} ${number.format(last?.previous ?? 0)}`}
		>
			<LineChart
				data={points}
				margin={{ top: 8, left: 12, right: 12, bottom: 8 }}
			>
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				{/* 20 % space under the lowest mean and 10 % over the highest: the lines fill the card but stay calm.
				    Math.abs keeps the space outside the line when a net gain is negative. */}
				<YAxis
					hide
					domain={[
						(lowest: number) => Math.floor(lowest - Math.abs(lowest) * 0.2),
						(highest: number) => Math.ceil(highest + Math.abs(highest) * 0.1),
					]}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(label) => formatDay(String(label))}
						/>
					}
				/>
				<Line
					dataKey="previous"
					type="monotone"
					stroke="var(--color-previous)"
					strokeWidth={2}
					strokeOpacity={0.6}
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
