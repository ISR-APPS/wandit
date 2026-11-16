// The trend plot of the chart form "compare": this period as a solid line over the previous period as a dashed line.
// The entity rows of the overview render it at mini height, the entity tabs at main height.
// It draws only the plot. The card around it gives the title and the legend.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { type DailyPoint, dayToDate, fillMessage } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type CompareTrendProps = {
	/** The name of the series, for the screen reader summary. */
	title: string;
	/** One point per working day, oldest first. */
	points: DailyPoint[];
	/** "mini" has no axes and no grid. "main" has both. */
	size: "mini" | "main";
	/** The height class of the plot, for example "h-16". */
	className?: string;
};

/** Screen readers get the last working day and its change against the matching day before the period. */
export function CompareTrend({
	title,
	points,
	size,
	className,
}: CompareTrendProps) {
	const { t, locale, dir } = useT();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 0,
	});
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	const config = {
		current: { label: t("chart.thisPeriod"), color: "var(--chart-1)" },
		previous: {
			label: t("chart.previousPeriod"),
			color: "var(--muted-foreground)",
		},
	} satisfies ChartConfig;
	const last = points.at(-1);
	// A previous value of 0 gives no change, so the text never says "0%" or "Infinity".
	const lastChange =
		last && last.previous > 0
			? ` ${percent.format((last.current - last.previous) / last.previous)} ${t("chart.vsPrevious")}`
			: "";
	const summary = last
		? fillMessage(t("chart.summary"), {
				title,
				day: formatDay(last.day),
				value: number.format(last.current),
			}) + lastChange
		: title;
	const isRtl = dir === "rtl";
	const isMain = size === "main";

	return (
		<ChartContainer
			config={config}
			className={cn("aspect-auto w-full", className)}
			role="img"
			aria-label={summary}
		>
			<LineChart
				data={points}
				// The margin on the axis side keeps the ticks off the edge of the plot.
				margin={
					isMain
						? { top: 8, bottom: 0, left: isRtl ? 8 : 0, right: isRtl ? 0 : 8 }
						: { top: 4, bottom: 4, left: 2, right: 2 }
				}
			>
				{isMain ? <CartesianGrid vertical={false} /> : null}
				<XAxis
					dataKey="day"
					hide={!isMain}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					reversed={isRtl}
					tickFormatter={formatDay}
				/>
				<YAxis
					hide={!isMain}
					width="auto"
					allowDecimals={false}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="line"
							labelFormatter={(day) => formatDay(String(day))}
						/>
					}
				/>
				<Line
					dataKey="current"
					type="monotone"
					stroke="var(--color-current)"
					dot={false}
					isAnimationActive={false}
				/>
				<Line
					dataKey="previous"
					type="monotone"
					stroke="var(--color-previous)"
					strokeDasharray="4 4"
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}
