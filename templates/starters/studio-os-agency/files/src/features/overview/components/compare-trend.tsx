// The trend plot of the chart form "compare": this period as a solid line over the previous period as a dashed line.
// The entity rows render it at mini height, the trend cards of the entity tabs at main height.
// It draws only the plot. The card around it gives the title and the legend.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { parseDay } from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { DailyPoint } from "../lib/series";

type CompareTrendProps = {
	/** The name of the series, for the screen reader summary. */
	title: string;
	/** One point per day, oldest first. */
	points: DailyPoint[];
	/** Intl options of the values, for example a currency. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** "mini" has no axes and no grid. "main" has both. */
	size: "mini" | "main";
	/** The height class of the plot, for example "h-16". */
	className?: string;
};

/** Screen readers get the last day and its change against the same day one period earlier. */
export function CompareTrend({
	title,
	points,
	format,
	size,
	className,
}: CompareTrendProps) {
	const { t, locale, dir } = useT();
	const value = new Intl.NumberFormat(locale, format);
	// The axis drops a unit: "1.6Kh" reads badly, and the card title names the unit.
	const compact = new Intl.NumberFormat(locale, {
		...(format?.style === "unit" ? {} : format),
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 0,
	});
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const formatDay = (day: string) => dayFormat.format(parseDay(day));
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
		? `${title}. ${formatDay(last.day)}: ${value.format(last.current)}${lastChange}`
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
						: { top: 6, bottom: 6, left: 2, right: 2 }
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
					// The mini plot has no axis, so it zooms to its data and the line fills the height.
					domain={isMain ? undefined : ["dataMin", "dataMax"]}
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
					tickFormatter={(tick: number) => compact.format(tick)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="line"
							valueFormat={format}
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
