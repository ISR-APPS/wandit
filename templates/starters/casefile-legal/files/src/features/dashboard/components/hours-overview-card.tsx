// The hours card of the dashboard: billable and non-billable hours per day, with its own period select.
// DashboardPage renders it at 2/3 width beside the team card, as the kit project overview chart.
// The /app loader fills the default period. Another period loads here and keeps the old chart until it is ready.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import {
	dayCountFormat,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
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
import { Skeleton } from "~/shared/ui/skeleton";
import {
	HOURS_DEFAULT_DAYS,
	hoursPerDayQueryOptions,
} from "../api/dashboard.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const HoursAreaChart = lazy(() =>
	import("./hours-area-chart").then((module) => ({
		default: module.HoursAreaChart,
	})),
);

/** The card spans 2 of 3 columns on a wide page. */
export function HoursOverviewCard() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(HOURS_DEFAULT_DAYS);
	const points = useQuery({
		...hoursPerDayQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	return (
		<Card className="@4xl/main:col-span-2">
			<CardHeader>
				<CardTitle>{t("dashboard.hoursTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.hoursDescription"), {
						period: dayCountFormat(locale).format(days),
					})}
				</CardDescription>
				<CardAction>
					<PeriodSelect days={days} onDaysChange={setDays} />
				</CardAction>
			</CardHeader>
			<CardContent>
				{points.isError ? (
					<div className="grid h-72 place-content-center justify-items-center gap-3">
						<p className="text-muted-foreground text-sm" role="alert">
							{t("dashboard.hoursError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => points.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : points.data === undefined ? (
					<Skeleton className="h-72" />
				) : (
					<Suspense fallback={<Skeleton className="h-72" />}>
						<HoursAreaChart series={points.data} />
					</Suspense>
				)}
			</CardContent>
		</Card>
	);
}
