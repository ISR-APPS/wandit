// The trend card of the Activities page: three totals of the period, then an area chart per day or as a running total.
// ActivitiesPage renders it with the period of the page header. The card reads the daily series of that period itself.
// The chart file loads with React.lazy. While a new period loads, the card keeps the last period, so the plot does not jump.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import {
	ChangeLine,
	type DailyPoint,
	dayToDate,
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
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { dailyActivitiesQueryOptions } from "../api/activities.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ActivityAreaChart = lazy(() =>
	import("./activity-area-chart").then((module) => ({
		default: module.ActivityAreaChart,
	})),
);

/** The two views of the plot: the count of each day, or the sum since the first day. */
const TREND_VIEWS = ["perDay", "runningTotal"] as const;
type TrendView = (typeof TREND_VIEWS)[number];

// Adds the days one by one, so the last point is the total of the period.
function toRunningTotal(points: DailyPoint[]): DailyPoint[] {
	let total = 0;
	return points.map((point) => {
		total += point.current;
		return { ...point, current: total };
	});
}

type ActivityTrendCardProps = {
	/** The period of the page header, in days. */
	days: PeriodDays;
};

/** The change of the total compares with the period before, of the same length. */
export function ActivityTrendCard({ days }: ActivityTrendCardProps) {
	const { t, locale } = useT();
	const trend = useQuery({
		...dailyActivitiesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const [view, setView] = useState<TrendView>("perDay");
	const number = new Intl.NumberFormat(locale);
	const average = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

	const points = trend.data ?? [];
	const totals = totalsOf(points);
	// The first busiest day wins a tie. reduce keeps the earlier point when the values are equal.
	const busiest = points.reduce<DailyPoint | null>(
		(best, point) => (best && best.current >= point.current ? best : point),
		null,
	);

	return (
		<Card className="@4xl/main:col-span-2">
			<CardHeader>
				<CardTitle>{t("activities.trendTitle")}</CardTitle>
				<CardDescription>{t("activities.trendDescription")}</CardDescription>
				<CardAction>
					<Tabs
						value={view}
						onValueChange={(value) =>
							setView(
								TREND_VIEWS.find((option) => option === value) ?? "perDay",
							)
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
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
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
				) : (
					<>
						<dl className="grid @xl/main:grid-cols-3 grid-cols-1 @xl/main:divide-x divide-y @xl/main:divide-y-0 rounded-md border rtl:divide-x-reverse">
							<div className="grid gap-1 px-4 py-3">
								<dt className="text-muted-foreground text-xs">
									{t("activities.logged")}
								</dt>
								<dd className="flex flex-wrap items-baseline gap-x-2">
									<span className="font-numeric font-semibold text-2xl tabular-nums">
										{number.format(totals.current)}
									</span>
									<ChangeLine change={totals.change} goodWhen="up" />
								</dd>
							</div>
							<div className="grid gap-1 px-4 py-3">
								<dt className="text-muted-foreground text-xs">
									{t("activities.dailyAverage")}
								</dt>
								<dd className="font-numeric font-semibold text-2xl tabular-nums">
									{average.format(
										points.length === 0 ? 0 : totals.current / points.length,
									)}
								</dd>
							</div>
							<div className="grid gap-1 px-4 py-3">
								<dt className="text-muted-foreground text-xs">
									{t("activities.busiestDay")}
								</dt>
								<dd className="flex flex-wrap items-baseline gap-x-2">
									<span className="font-numeric font-semibold text-2xl tabular-nums">
										{number.format(busiest?.current ?? 0)}
									</span>
									{busiest && busiest.current > 0 ? (
										<span className="text-muted-foreground text-sm">
											{dayFormat.format(dayToDate(busiest.day))}
										</span>
									) : null}
								</dd>
							</div>
						</dl>
						{totals.current === 0 && totals.previous === 0 ? (
							<p className="grid h-64 content-center text-center text-muted-foreground text-sm">
								{t("chart.empty")}
							</p>
						) : (
							<Suspense fallback={<Skeleton className="h-64 w-full" />}>
								<ActivityAreaChart
									points={view === "perDay" ? points : toRunningTotal(points)}
								/>
							</Suspense>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
