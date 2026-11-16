// The plot of a stacked trend: one bar per day, split into one segment per channel.
// The home conversions panel and the campaign spend panel render it under their header and legend.
// It follows the chart form "stacked" of the app-dashboard skill. Each channel keeps its color on every page.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import { type Channel, channelColor } from "../lib/channels";
import { dayToDate, fillMessage } from "../lib/format";
import type { ChannelPoint } from "../lib/series";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** One bar: the day, then one value per channel code. The channel codes are CSS-safe ChartConfig keys. */
type StackRow = { day: string } & Partial<Record<Channel, number>>;

type ChannelStackChartProps = {
	/** One point per day and channel, oldest first. */
	points: ChannelPoint[];
	/** The series, the bottom one first. At most 5: one per channel. */
	channels: readonly Channel[];
	/** The panel title. The aria-label of the plot starts with it. */
	title: string;
	/** Intl options of the values, for example a currency. A plain number when absent. */
	valueFormat?: Intl.NumberFormatOptions;
	/** The height class of the plot, for example "h-64", or "h-full" in a parent with a set height. */
	className?: string;
};

/** Every value 0: the plot keeps its height and its dates, hides the Y axis, and shows one sentence. */
export function ChannelStackChart({
	points,
	channels,
	title,
	valueFormat,
	className,
}: ChannelStackChartProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const value = new Intl.NumberFormat(locale, valueFormat);
	const compact = new Intl.NumberFormat(locale, {
		...valueFormat,
		notation: "compact",
		maximumFractionDigits: 1,
	});
	// The day keys are midnight UTC, so the UTC time zone keeps the same calendar day.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

	const config = Object.fromEntries(
		channels.map((channel) => [
			channel,
			{ label: t(`channels.${channel}`), color: channelColor(channel) },
		]),
	) satisfies ChartConfig;

	const rowsByDay = new Map<string, StackRow>();
	for (const point of points) {
		const row = rowsByDay.get(point.day) ?? { day: point.day };
		row[point.channel] = (row[point.channel] ?? 0) + point.value;
		rowsByDay.set(point.day, row);
	}
	const rows = [...rowsByDay.values()];
	const lastRow = rows.at(-1);
	const isEmpty = points.every((point) => point.value === 0);

	return (
		<div className={cn("relative", className)}>
			<ChartContainer
				config={config}
				className="aspect-auto h-full w-full"
				role="img"
				aria-label={
					lastRow
						? fillMessage(t("chart.stackLabel"), {
								title,
								day: dayFormat.format(dayToDate(lastRow.day)),
								values: new Intl.ListFormat(locale, { type: "unit" }).format(
									channels.map(
										(channel) =>
											`${t(`channels.${channel}`)} ${value.format(lastRow[channel] ?? 0)}`,
									),
								),
							})
						: title
				}
			>
				<BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="day"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						minTickGap={24}
						reversed={dir === "rtl"}
						tickFormatter={(day: string) => dayFormat.format(dayToDate(day))}
					/>
					<YAxis
						hide={isEmpty}
						width="auto"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						allowDecimals={false}
						orientation={dir === "rtl" ? "right" : "left"}
						tick={dir === "rtl" ? { textAnchor: "end" } : undefined}
						tickFormatter={(tick: number) => compact.format(tick)}
					/>
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								valueFormat={valueFormat}
								labelFormatter={(day) =>
									dayFormat.format(dayToDate(String(day)))
								}
							/>
						}
					/>
					{channels.map((channel, index) => (
						<Bar
							key={channel}
							dataKey={channel}
							stackId="day"
							fill={`var(--color-${channel})`}
							// Only the top segment has round top corners.
							radius={
								index === channels.length - 1 ? [barRadius, barRadius, 0, 0] : 0
							}
							isAnimationActive={false}
						/>
					))}
				</BarChart>
			</ChartContainer>
			{isEmpty ? (
				<p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
					{t("chart.empty")}
				</p>
			) : null}
		</div>
	);
}
