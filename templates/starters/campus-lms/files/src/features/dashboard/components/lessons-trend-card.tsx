// The lessons card of the home: the lessons finished per day over 7, 30, or 90 days, as an area to the card edges.
// DashboardPage renders it in the bottom band. The card holds its period; the /app loader prefetches the default one.
// The description compares the total with the period before. The chart file loads with React.lazy.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import {
	dayCountFormat,
	FLAT_CHANGE,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	totalsOf,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { lessonsTrendQueryOptions } from "../api/dashboard.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const LessonsAreaChart = lazy(() =>
	import("./lessons-area-chart").then((module) => ({
		default: module.LessonsAreaChart,
	})),
);

/** 30 days. The /app loader prefetches this period, so the card shows at once. */
export const TREND_DEFAULT_DAYS: PeriodDays = 30;

/** The period select changes the query key, so each period has its own cache entry. */
export function LessonsTrendCard() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(TREND_DEFAULT_DAYS);
	// Another period keeps the old chart until its points are ready.
	const trend = useQuery({
		...lessonsTrendQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const delta = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
		signDisplay: "exceptZero",
	});
	const totals = trend.data ? totalsOf(trend.data) : null;

	return (
		// overflow-hidden: the area runs to the edges, so the card corners must clip it.
		<Card className="overflow-hidden pb-0">
			<CardHeader>
				<CardTitle>{t("dashboard.lessonsTitle")}</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-2">
					{totals
						? fillMessage(t("dashboard.lessonsCompare"), {
								current: number.format(totals.current),
								previous: number.format(totals.previous),
								period: dayCountFormat(locale).format(days),
							})
						: t("dashboard.loading")}
					{totals?.change != null && Math.abs(totals.change) >= FLAT_CHANGE ? (
						// The kit has no tinted red variant. A drop uses the recipe of the success variant in red.
						<Badge
							variant={totals.change > 0 ? "success" : "outline"}
							className={
								totals.change > 0
									? undefined
									: "border-destructive/25 bg-destructive/12 text-destructive"
							}
						>
							<bdi dir="ltr">{delta.format(totals.change)}</bdi>
						</Badge>
					) : null}
				</CardDescription>
				<CardAction>
					<PeriodSelect days={days} onDaysChange={setDays} />
				</CardAction>
			</CardHeader>
			{trend.isError ? (
				<div className="grid justify-items-start gap-3 px-6 pb-6">
					<p className="text-sm" role="alert">
						{t("dashboard.sectionError")}
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
			) : !trend.data ? (
				<Skeleton className="@4xl/main:h-104 h-72" />
			) : totals?.current === 0 ? (
				<p className="px-6 pb-6 text-muted-foreground text-sm">
					{t("dashboard.noLessons")}
				</p>
			) : (
				<Suspense fallback={<Skeleton className="@4xl/main:h-104 h-72" />}>
					<LessonsAreaChart points={trend.data} />
				</Suspense>
			)}
		</Card>
	);
}
