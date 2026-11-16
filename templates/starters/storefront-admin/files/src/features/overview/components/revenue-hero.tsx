// The hero panel of the home: the revenue of the period as one large figure, its change, and a large sparkline.
// OverviewPage renders it and holds the period. The panel reads the daily series of that period itself,
// because the period changes after a click. RevenueChart draws the sparkline. It follows the home "hero" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import {
	ChangeLine,
	dayCountFormat,
	dayToDate,
	fillMessage,
	moneyFormat,
	type PeriodDays,
	totalsOf,
} from "~/features/shop";
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
import { revenuePerDayQueryOptions } from "../api/overview.queries";
import { PeriodTabs } from "./period-tabs";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const RevenueChart = lazy(() =>
	import("./revenue-chart").then((module) => ({
		default: module.RevenueChart,
	})),
);

type RevenueHeroProps = {
	/** The period of the figure and of the chart, in days. OverviewPage holds it. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** While a new period loads, the panel keeps the figure of the last period, so the page does not jump. */
export function RevenueHero({ days, onDaysChange }: RevenueHeroProps) {
	const { t, locale } = useT();
	const revenue = useQuery({
		...revenuePerDayQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	const money = moneyFormat(locale, "whole");
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));

	const points = revenue.data ?? [];
	// The hero is a flow: the total of the period, against the same count of days just before.
	const totals = totalsOf(points);
	const firstPoint = points[0];
	const lastPoint = points.at(-1);
	const bestPoint = points.reduce<(typeof points)[number] | undefined>(
		(best, point) => (best && best.current >= point.current ? best : point),
		undefined,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.revenue")}</CardTitle>
				{/* col-start-1 keeps the range under the title when the control leaves the end column. */}
				<CardDescription className="col-start-1">
					{firstPoint && lastPoint
						? fillMessage(t("overview.periodRange"), {
								days: dayCountFormat(locale).format(points.length),
								from: formatDay(firstPoint.day),
								to: formatDay(lastPoint.day),
							})
						: null}
				</CardDescription>
				{/* On a narrow card the control sits under the title, so the date range stays on one line. */}
				<CardAction className="@md/card-header:col-start-2 col-start-1 @md/card-header:row-span-2 row-span-1 @md/card-header:row-start-1 row-start-3 justify-self-start @md/card-header:justify-self-end">
					<PeriodTabs days={days} onDaysChange={onDaysChange} />
				</CardAction>
			</CardHeader>
			<CardContent>
				{revenue.isError ? (
					<div className="grid h-44 content-center justify-items-center gap-3 text-center">
						<p className="text-sm" role="alert">
							{t("overview.revenueError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => revenue.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : revenue.data === undefined || !lastPoint ? (
					<Skeleton className="h-44 w-full" />
				) : (
					<div className="grid @4xl/main:grid-cols-[minmax(0,auto)_minmax(0,1fr)] grid-cols-1 items-end @4xl/main:gap-10 gap-6">
						<div className="grid gap-4">
							<div className="grid gap-2">
								{/* One figure alone needs no column digits. Proportional digits keep the number tight at this size. */}
								<p className="font-numeric font-semibold @4xl/main:text-7xl text-5xl leading-none tracking-tight">
									{money.format(totals.current)}
								</p>
								<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
									<ChangeLine change={totals.change} goodWhen="up" />
									{totals.change === null ? null : (
										<p className="text-muted-foreground text-sm">
											{fillMessage(t("overview.againstBefore"), {
												amount: money.format(totals.previous),
												days: dayCountFormat(locale).format(points.length),
											})}
										</p>
									)}
								</div>
							</div>
							<dl className="flex gap-8 border-t pt-4 text-sm">
								<div className="grid gap-0.5">
									<dt className="text-muted-foreground">
										{t("overview.dailyAverage")}
									</dt>
									<dd className="font-medium tabular-nums">
										{money.format(totals.current / points.length)}
									</dd>
								</div>
								{bestPoint ? (
									<div className="grid gap-0.5">
										<dt className="text-muted-foreground">
											{t("overview.bestDay")}
										</dt>
										<dd className="font-medium tabular-nums">
											{`${money.format(bestPoint.current)} · ${formatDay(bestPoint.day)}`}
										</dd>
									</div>
								) : null}
							</dl>
						</div>
						<div className="grid min-w-0 gap-1.5">
							{/* The chart script loads after the page. The placeholder has the height of the chart. */}
							<Suspense
								fallback={<Skeleton className="@4xl/main:h-40 h-28 w-full" />}
							>
								<RevenueChart points={points} />
							</Suspense>
							<div className="flex justify-between px-1.5 text-muted-foreground text-xs tabular-nums">
								<span>{formatDay(firstPoint?.day ?? lastPoint.day)}</span>
								<span>{formatDay(lastPoint.day)}</span>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
