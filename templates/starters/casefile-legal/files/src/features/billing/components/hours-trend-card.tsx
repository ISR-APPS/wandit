// The trend of logged hours: one bar per day, with a period control and two views (per day, running total).
// BillingPage renders it beside the breakdown. It reads its period with useQuery, because the key changes on a click.
// It follows the chart form "bars" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	BAR_RADIUS_PX,
	ChangeLine,
	type DailyPoint,
	dayCountFormat,
	dayToDate,
	fillMessage,
	hoursFormat,
	PERIOD_DAYS,
	type PeriodDays,
	toTenths,
	totalsOf,
} from "~/features/practice";
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
import { useAppTheme } from "~/styles/theme";
import { hoursPerDayQueryOptions } from "../api/billing.queries";

// The two views of the same entries: the hours of each day, and the sum since the first day.
const TREND_VIEWS = ["perDay", "runningTotal"] as const;
type TrendView = (typeof TREND_VIEWS)[number];

function toRunningTotal(points: DailyPoint[]): DailyPoint[] {
	let total = 0;
	return points.map((point) => {
		total += point.current;
		return { ...point, current: toTenths(total) };
	});
}

type HoursTrendCardProps = {
	/** The period of the plot, in days. BillingPage holds it. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** While a new period loads, the card keeps the bars of the last period, so the plot does not jump. */
export function HoursTrendCard({ days, onDaysChange }: HoursTrendCardProps) {
	const { t, locale, dir } = useT();
	const trend = useQuery({
		...hoursPerDayQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const [view, setView] = useState<TrendView>("perDay");
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const hours = hoursFormat(locale);
	const wholeHours = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	});
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const dayCount = dayCountFormat(locale);
	const chartConfig = {
		current: { label: t("billing.hoursTitle"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	const points = trend.data ?? [];
	const totals = totalsOf(points);
	const plotted = view === "perDay" ? points : toRunningTotal(points);
	const lastPoint = points.at(-1);
	const isRtl = dir === "rtl";

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("billing.hoursTitle")}</CardTitle>
				{/* In a narrow card the total takes the full width under the title and the Select, so it does not wrap. */}
				<CardDescription className="@md/card-header:col-span-1 col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1">
					{trend.data ? (
						<>
							<span>
								<span className="font-numeric font-semibold text-foreground text-lg tabular-nums">
									{wholeHours.format(totals.current)}
								</span>{" "}
								{fillMessage(t("billing.hoursTotal"), {
									period: dayCount.format(days),
								})}
							</span>
							<ChangeLine change={totals.change} goodWhen="up" />
						</>
					) : (
						<Skeleton className="h-7 w-40" />
					)}
				</CardDescription>
				{/* One grid-row value per width: a row-span utility alone resets the row start of the base class. */}
				<CardAction className="@md/card-header:row-[1/span_2] row-1">
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
					<div className="grid h-64 content-center justify-items-center gap-3 text-center">
						<p className="text-sm" role="alert">
							{t("billing.loadError")}
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
					<Skeleton className="h-64 w-full" />
				) : totals.current === 0 && totals.previous === 0 ? (
					<div className="grid h-64 content-center justify-items-center gap-2 text-center text-sm">
						<p className="text-muted-foreground">{t("chart.empty")}</p>
						<Link to="/app/matters" className="underline underline-offset-4">
							{t("chart.emptyAction")}
						</Link>
					</div>
				) : (
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-64 w-full"
						role="img"
						aria-label={
							lastPoint
								? fillMessage(t("billing.chartLabel"), {
										title: t("billing.hoursTitle"),
										period: dayCount.format(days),
										hours: hours.format(lastPoint.current),
									})
								: t("billing.hoursTitle")
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
										valueFormat={{
											minimumFractionDigits: 1,
											maximumFractionDigits: 1,
										}}
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
