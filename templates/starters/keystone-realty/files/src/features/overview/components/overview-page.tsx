// The home behind login, in the main-rail layout: the trend and the newest listings in the main column,
// and a rail with the leads that wait for an answer, the figures, and the next viewings.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { countLabel } from "~/features/agency";
import { PageHeader } from "~/features/app-shell";
import { leadsQueryOptions } from "~/features/leads";
import { listingsQueryOptions } from "~/features/listings";
import { viewingsQueryOptions } from "~/features/viewings";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewKpisQueryOptions } from "../api/overview.queries";
import type { PeriodDays } from "../lib/series";
import { AttentionCard } from "./attention-card";
import { FiguresCard, FiguresCardSkeleton } from "./figures-card";
import { LeadsTrendCard, LeadsTrendCardSkeleton } from "./leads-trend-card";
import { NewestListingsCard } from "./newest-listings-card";
import { NextViewingsCard } from "./next-viewings-card";

/** The period of the trend on the first load, in days. The home loader prefetches this period. */
export const DEFAULT_DAYS: PeriodDays = 30;
// The rail shows the first 3 KPI rows of overviewKpisQueryOptions().
const KPI_COUNT = 3;

// From 56rem: the main column at the start, and a rail of 20rem at the end. Below: one column, the rail first.
// 20rem gives the attention rows room for "Valuation in Stonebridge" beside the late badge.
const HOME_GRID =
	"grid @4xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start @3xl/main:gap-6 gap-4";
// top-20: under the h-14 app header, with a gap. The rail never scrolls inside itself.
// From 42rem to 56rem the rail cards sit in two columns, so a small laptop shows the work and the figures.
// The rail cards use smaller paddings than the main cards, so the sticky rail (5 + 3 + 5 rows) stays shorter than a 900 px screen.
const RAIL =
	"@4xl/main:sticky @4xl/main:top-20 @4xl/main:col-start-2 @4xl/main:row-start-1 grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-1 gap-4 @4xl/main:gap-3 *:data-[slot=card]:gap-3 *:data-[slot=card]:py-5 @4xl/main:*:data-[slot=card]:py-4";
// In two columns, the attention list and the next viewings share the first row. The figures span the second row.
const FIGURES_SPAN =
	"@2xl/main:col-span-2 @4xl/main:col-span-1 @2xl/main:row-start-2 @4xl/main:row-start-auto";
const MAIN_COLUMN =
	"@4xl/main:col-start-1 @4xl/main:row-start-1 flex min-w-0 flex-col @3xl/main:gap-6 gap-4";

/** The rail comes first in the DOM, so the attention list opens the page on a phone. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: leads } = useSuspenseQuery(leadsQueryOptions());
	const { data: listings } = useSuspenseQuery(listingsQueryOptions());
	const { data: viewings } = useSuspenseQuery(viewingsQueryOptions());
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const now = Date.now();

	// LIMIT: reads the newest 1,000 rows. Upgrade: a query of the leads with no answer, oldest first.
	const waitingLeads = leads.filter((lead) => lead.status === "new");
	// LIMIT: reads the newest 1,000 rows. Upgrade: a query of the viewings to come, by start time.
	const upcomingViewings = viewings.filter(
		(viewing) =>
			(viewing.status === "requested" || viewing.status === "confirmed") &&
			Date.parse(viewing.startsAt) > now,
	);
	const activeCount = listings.filter(
		(listing) => listing.status === "active",
	).length;
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(now);

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				description={[
					today,
					countLabel(
						activeCount,
						t("overview.activeOne"),
						t("overview.activeOther"),
						locale,
					),
					countLabel(
						upcomingViewings.length,
						t("overview.upcomingOne"),
						t("overview.upcomingOther"),
						locale,
					),
				].join(" · ")}
			/>
			<div className={HOME_GRID}>
				<div className={RAIL}>
					<AttentionCard waitingLeads={waitingLeads} now={now} />
					<FiguresCard
						className={FIGURES_SPAN}
						items={kpis.slice(0, KPI_COUNT).map(({ labelKey, ...item }) => ({
							...item,
							label: t(labelKey),
						}))}
					/>
					<NextViewingsCard upcomingViewings={upcomingViewings} now={now} />
				</div>
				<div className={MAIN_COLUMN}>
					<LeadsTrendCard days={days} onDaysChange={setDays} />
					<NewestListingsCard listings={listings} now={now} />
				</div>
			</div>
		</div>
	);
}

// Placeholder rows of the skeleton lists. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5"];

/** Placeholder while the home loader runs: the main column and the rail, in their final shape. */
export function OverviewPageSkeleton() {
	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className={HOME_GRID}>
				<div className={RAIL}>
					<Card>
						<CardHeader>
							<Skeleton className="h-4 w-32" />
						</CardHeader>
						<CardContent className="grid gap-3">
							{SKELETON_ROWS.map((key) => (
								<Skeleton key={key} className="h-10 w-full" />
							))}
						</CardContent>
					</Card>
					<FiguresCardSkeleton count={KPI_COUNT} />
				</div>
				<div className={MAIN_COLUMN}>
					<LeadsTrendCardSkeleton />
					<Card>
						<CardHeader>
							<Skeleton className="h-4 w-36" />
						</CardHeader>
						<CardContent className="grid gap-3">
							{SKELETON_ROWS.map((key) => (
								<Skeleton key={key} className="h-12 w-full" />
							))}
						</CardContent>
					</Card>
				</div>
			</div>
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
