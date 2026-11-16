// The trend tile of the home: the portfolio value per day as a solid line, over the previous period as a dashed line.
// Under the plot, the average value of both periods and their difference.
// PortfolioPage renders it and holds the period. The tile reads the series of that period itself,
// because the period changes after a click. It follows the trend part of the chart form "compare".
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
	ChangeText,
	CURRENCY,
	changeRatio,
	dayToDate,
	fillMessage,
	moneyFormat,
	niceTicks,
	PERIOD_DAYS,
	type PeriodDays,
	parsePeriodDays,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { portfolioValuesQueryOptions } from "../api/portfolio.queries";

type ValueTrendTileProps = {
	/** The period of the plot, in days. PortfolioPage holds it. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
	/** The grid span of the tile in the mosaic. */
	className?: string;
};

// The mean of a list of amounts. 0 for an empty list, so no NaN reaches the text.
function averageOf(values: number[]): number {
	return values.length === 0
		? 0
		: values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** While a new period loads, the tile keeps the lines of the last period, so the plot does not jump. */
export function ValueTrendTile({
	days,
	onDaysChange,
	className,
}: ValueTrendTileProps) {
	const { t, locale, dir } = useT();
	const trend = useQuery({
		...portfolioValuesQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	const compactMoney = moneyFormat(locale, "compact");
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	// "7d", "30d", "90d": the short form fits three tabs in the header of a phone.
	const shortDays = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
	});
	const config = {
		current: { label: t("chart.thisPeriod"), color: "var(--chart-1)" },
		previous: {
			label: t("chart.previousPeriod"),
			color: "var(--muted-foreground)",
		},
	} satisfies ChartConfig;
	const points = trend.data ?? [];
	const lastPoint = points.at(-1);
	const values = points.flatMap((point) => [point.current, point.previous]);
	const axis = niceTicks(Math.min(...values), Math.max(...values));
	const isRtl = dir === "rtl";
	const currentAverage = averageOf(points.map((point) => point.current));
	const previousAverage = averageOf(points.map((point) => point.previous));
	const averageChange = changeRatio(currentAverage, previousAverage);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("portfolio.trendTitle")}</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<span className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className="h-0.5 w-4 rounded-full bg-chart-1"
						/>
						{t("chart.thisPeriod")}
					</span>
					<span className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className="w-4 border-muted-foreground border-t border-dashed"
						/>
						{t("chart.previousPeriod")}
					</span>
				</CardDescription>
				<CardAction>
					<Tabs
						value={String(days)}
						onValueChange={(value) => onDaysChange(parsePeriodDays(value))}
					>
						<TabsList
							aria-label={t("chart.period")}
							// A touch target of 44 px on a phone.
							className="max-sm:group-data-[orientation=horizontal]/tabs:h-11"
						>
							{PERIOD_DAYS.map((period) => (
								<TabsTrigger
									key={period}
									value={String(period)}
									className="px-3"
								>
									{shortDays.format(period)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{/* The plot fills the tile, which is two rows of the mosaic high. On a phone it keeps 18rem. */}
				<div className="relative min-h-72 flex-1">
					{trend.isError ? (
						<div className="absolute inset-0 grid content-center justify-items-center gap-3 text-center">
							<p className="text-sm" role="alert">
								{t("chart.loadError")}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => trend.refetch()}
							>
								{t("common.retry")}
							</Button>
						</div>
					) : trend.data === undefined ? (
						<Skeleton className="absolute inset-0" />
					) : (
						<ChartContainer
							config={config}
							className={cn(
								"absolute inset-0 aspect-auto h-full w-full",
								// The lines of the last period stay while the new period loads, a little faded.
								trend.isPlaceholderData && "opacity-60",
							)}
							role="img"
							aria-label={
								lastPoint
									? fillMessage(t("portfolio.trendSummary"), {
											title: t("portfolio.trendTitle"),
											day: dayFormat.format(dayToDate(lastPoint.day)),
											value: moneyFormat(locale).format(lastPoint.current),
										})
									: t("portfolio.trendTitle")
							}
						>
							<LineChart
								data={points}
								// The margin on the axis side keeps the ticks off the edge of the plot.
								margin={{
									top: 8,
									bottom: 0,
									left: isRtl ? 8 : 4,
									right: isRtl ? 4 : 8,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="day"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={24}
									reversed={isRtl}
									tickFormatter={(day: string) =>
										dayFormat.format(dayToDate(day))
									}
								/>
								{/* A value line shows its moves, not its size: the scale starts near the lowest day, not at 0. */}
								<YAxis
									width="auto"
									domain={[axis.ticks[0] ?? 0, axis.ticks.at(-1) ?? 0]}
									ticks={axis.ticks}
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									orientation={isRtl ? "right" : "left"}
									tick={{ textAnchor: "end" }}
									tickFormatter={(value: number) => compactMoney.format(value)}
								/>
								<ChartTooltip
									cursor={false}
									content={
										<ChartTooltipContent
											indicator="line"
											labelFormatter={(day) =>
												dayFormat.format(dayToDate(String(day)))
											}
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
					)}
				</div>
				{points.length === 0 ? null : (
					<dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
						<div className="grid gap-0.5">
							<dt className="text-muted-foreground text-xs">
								{t("portfolio.trendAverage")}
							</dt>
							<dd className="font-medium tabular-nums">
								{compactMoney.format(currentAverage)}
							</dd>
						</div>
						<div className="grid gap-0.5">
							<dt className="text-muted-foreground text-xs">
								{t("portfolio.trendPreviousAverage")}
							</dt>
							<dd className="font-medium tabular-nums">
								{compactMoney.format(previousAverage)}
							</dd>
						</div>
						<div className="grid gap-0.5">
							<dt className="text-muted-foreground text-xs">
								{t("portfolio.trendDifference")}
							</dt>
							<dd className="font-medium">
								{averageChange === null ? (
									t("kpi.noComparison")
								) : (
									<ChangeText change={averageChange} />
								)}
							</dd>
						</div>
					</dl>
				)}
			</CardContent>
		</Card>
	);
}
