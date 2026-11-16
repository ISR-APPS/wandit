// The home of the box office (home "hero"): the revenue hero, the facts row, and the next events.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period of the hero. The facts keep the 30 days of the KPI query.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { countLabel, fillMessage, startOfLocalDay } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	dailyRevenueQueryOptions,
	nextEventsQueryOptions,
	overviewKpisQueryOptions,
	todaySalesQueryOptions,
} from "../api/overview.queries";
import { KPI_DAYS } from "../lib/overview-math";
import type { PeriodDays } from "../lib/series";
import { KpiFacts, KpiFactsSkeleton } from "./kpi-facts";
import { NextEventsList, NextEventsListSkeleton } from "./next-events-list";
import { RevenueHero, RevenueHeroSkeleton } from "./revenue-hero";

/** The period of the hero on the first load. The loader prefetches it. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** The home page. A period click refetches only the hero; the old points stay until the new ones arrive. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const revenue = useQuery({
		...dailyRevenueQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: nextEvents } = useSuspenseQuery(nextEventsQueryOptions());
	const { data: today } = useSuspenseQuery(todaySalesQueryOptions());

	const now = Date.now();
	const todayStart = startOfLocalDay(now);
	const eventsToday = nextEvents.filter(
		(event) => startOfLocalDay(event.startsAt) === todayStart,
	).length;
	const longDate = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	return (
		<div className="grid gap-8">
			<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
				<div className="grid min-w-0 gap-1">
					<h1 className="font-(--heading-weight) font-display text-3xl tracking-(--heading-tracking)">
						{t("overview.title")}
					</h1>
					<p className="text-muted-foreground text-sm">
						{longDate.format(now)}
						{" · "}
						{eventsToday === 0
							? t("overview.noEventToday")
							: countLabel(
									eventsToday,
									t("overview.eventsTodayOne"),
									t("overview.eventsTodayOther"),
									locale,
								)}
					</p>
				</div>
				<Button asChild>
					<Link to="/app/attendees">{t("overview.openGuestList")}</Link>
				</Button>
			</div>
			{revenue.data ? (
				<RevenueHero
					points={revenue.data}
					days={days}
					onDaysChange={setDays}
					today={today}
				/>
			) : revenue.isError ? (
				<RevenueHeroError onRetry={() => revenue.refetch()} />
			) : (
				<RevenueHeroSkeleton />
			)}
			<section className="grid gap-4" aria-labelledby="facts-title">
				<h2
					id="facts-title"
					className="label-text font-sans text-muted-foreground text-sm"
				>
					{fillMessage(t("overview.factsPeriod"), { days: KPI_DAYS })}
				</h2>
				<KpiFacts
					items={kpis.map(({ labelKey, ...item }) => ({
						...item,
						label: t(labelKey),
					}))}
				/>
			</section>
			<NextEventsList events={nextEvents} now={now} />
		</div>
	);
}

type RevenueHeroErrorProps = {
	/** Runs the hero query again. */
	onRetry: () => void;
};

// The hero alone failed after a period click. The rest of the page stays.
function RevenueHeroError({ onRetry }: RevenueHeroErrorProps) {
	const { t } = useT();
	return (
		<div className="grid justify-items-start gap-3 rounded-surface border p-6">
			<p role="alert" className="text-sm">
				{t("overview.revenueError")}
			</p>
			<Button type="button" variant="outline" onClick={onRetry}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

/** Placeholder while the home loader runs: the header, the hero, the facts row, and 5 list rows. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-8">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-9 w-48" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-9 w-36" />
			</div>
			<RevenueHeroSkeleton />
			<KpiFactsSkeleton />
			<NextEventsListSkeleton />
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("overview.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
