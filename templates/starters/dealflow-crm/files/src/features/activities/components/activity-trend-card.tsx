// The trend card of the activities page: one bar per day, two views of the same counts, and a period control.
// ActivitiesPage renders it and holds the period. The card reads the daily series of that period itself,
// because the period changes after a click. It follows the chart form "bars" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	ChangeLine,
	type DailyPoint,
	dayCountFormat,
	dayToDate,
	fillMessage,
	PERIOD_DAYS,
	type PeriodDays,
	totalsOf,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import { dailyActivitiesQueryOptions } from "../api/activities.queries";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** The two views of the plot: the count of each day, or the sum since the first day. */
const TREND_VIEWS = ["perDay", "runningTotal"] as const;
type TrendView = (typeof TREND_VIEWS)[number];

// Adds the days one by one, so the last bar is the total of the period.
function toRunningTotal(points: DailyPoint[]): DailyPoint[] {
	let total = 0;
	return points.map((point) => {
		total += point.current;
		return { ...point, current: total };
	});
}

type ActivityTrendCardProps = {
	/** The period of the plot, in days. ActivitiesPage holds it. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** While a new period loads, the card keeps the bars of the last period, so the plot does not jump. */
export function ActivityTrendCard({
	days,
	onDaysChange,
}: ActivityTrendCardProps) {
	const { t, locale, dir } = useT();
	const trend = useQuery({
		...dailyActivitiesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const [view, setView] = useState<TrendView>("perDay");
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];

	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const dayCount = dayCountFormat(locale);
	const chartConfig = {
		current: { label: t("activities.title"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	const points = trend.data ?? [];
	const totals = totalsOf(points);
	const plotted = view === "perDay" ? points : toRunningTotal(points);
	const lastPoint = points.at(-1);
	const isRtl = dir === "rtl";

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("activities.trendTitle")}</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
					{trend.data ? (
						<>
							<span>
								<span className="font-numeric font-semibold text-foreground text-lg tabular-nums">
									{number.format(totals.current)}
								</span>{" "}
								{t("activities.trendUnit")}
							</span>
							<ChangeLine change={totals.change} goodWhen="up" />
						</>
					) : (
						<Skeleton className="h-7 w-40" />
					)}
				</CardDescription>
				<CardAction>
					<Select
						value={String(days)}
						onValueChange={(value) => {
							const next = PERIOD_DAYS.find(
								(period) => String(period) === value,
							);
							if (next) {
								onDaysChange(next);
							}
						}}
					>
						<SelectTrigger aria-label={t("chart.period")} className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{PERIOD_DAYS.map((period) => (
								<SelectItem key={period} value={String(period)}>
									{dayCount.format(period)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Tabs
					value={view}
					onValueChange={(value) =>
						setView(TREND_VIEWS.find((option) => option === value) ?? "perDay")
					}
				>
					<TabsList>
						{TREND_VIEWS.map((option) => (
							<TabsTrigger key={option} value={option}>
								{t(`chart.${option}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				{trend.isError ? (
					<div className="grid h-80 content-center justify-items-center gap-3 text-center">
						<p className="text-sm" role="alert">
							{t("activities.trendError")}
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
					<Skeleton className="h-80 w-full" />
				) : totals.current === 0 && totals.previous === 0 ? (
					<p className="grid h-80 content-center text-center text-muted-foreground text-sm">
						{t("chart.empty")}
					</p>
				) : (
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-80 w-full"
						role="img"
						aria-label={
							lastPoint
								? fillMessage(t("activities.trendLabel"), {
										day: dayFormat.format(dayToDate(lastPoint.day)),
										count: number.format(lastPoint.current),
									})
								: t("activities.trendTitle")
						}
					>
						<BarChart
							data={plotted}
							// The margin on the axis side keeps the ticks off the edge of the plot.
							margin={{
								top: 4,
								bottom: 0,
								left: isRtl ? 0 : 4,
								right: isRtl ? 4 : 0,
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
											dayFormat.format(dayToDate(String(day)))
										}
									/>
								}
							/>
							<Bar
								dataKey="current"
								fill="var(--color-current)"
								radius={[barRadius, barRadius, 0, 0]}
								isAnimationActive={false}
							/>
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
