// The home of Quota: the KPI band, the bookings trend beside the territory breakdown, and the newest orders.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The home spec is kpi-band: one row of equal figures, then the charts row, then the newest rows.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { ordersQueryOptions } from "~/features/orders";
import {
	fillMessage,
	PageError,
	type PeriodDays,
	quarterLabelOf,
	quarterOfDay,
	quarterProgressOf,
	todayDayNumber,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	KPI_WINDOW_DAYS,
	overviewKpisQueryOptions,
	territoryBookingsQueryOptions,
} from "../api/overview.queries";
import { BookingsTrendCard } from "./bookings-trend-card";
import { KpiFigures, KpiFiguresSkeleton } from "./kpi-figures";
import { NewestOrdersCard } from "./newest-orders-card";
import { TerritoryBreakdownCard } from "./territory-breakdown-card";

/** The trend period of the first load, in days. */
export const DEFAULT_DAYS: PeriodDays = 30;

// The band shows 4 figures: bookings, orders, average order, and quarter attainment.
const KPI_COUNT = 4;
// The newest rows panel shows the first 6 orders.
const NEWEST_ROWS = 6;

const BAND_CLASS = "@xl/main:grid-cols-2 @5xl/main:grid-cols-4";

/** The home page. It holds the trend period; the other panels read the cache of the loader. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: territories } = useSuspenseQuery(
		territoryBookingsQueryOptions(KPI_WINDOW_DAYS),
	);
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());

	const today = todayDayNumber();
	const quarter = quarterOfDay(today);
	const progress = quarterProgressOf(quarter, today);
	const number = new Intl.NumberFormat(locale);
	const quarterLine = fillMessage(t("calendar.quarterDay"), {
		quarter: quarterLabelOf(quarter),
		// The day of today is the next day after the elapsed days.
		day: number.format(progress.elapsedDays + 1),
		total: number.format(progress.totalDays),
	});

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				description={`${t("overview.scope")} · ${quarterLine}`}
				actions={
					<Button asChild>
						<Link to="/app/targets">{t("overview.openTargets")}</Link>
					</Button>
				}
			/>
			<KpiFigures
				items={kpis
					.slice(0, KPI_COUNT)
					.map((kpi) => ({ ...kpi, label: t(kpi.labelKey) }))}
				className={BAND_CLASS}
			/>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2">
					<BookingsTrendCard days={days} onDaysChange={setDays} />
				</div>
				<TerritoryBreakdownCard slices={territories} />
			</div>
			<NewestOrdersCard orders={orders.slice(0, NEWEST_ROWS)} />
		</div>
	);
}

/** Placeholder while the home loader runs. It draws the band, the charts row, and the table in their final spans. */
export function OverviewPageSkeleton() {
	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-80" />
				</div>
				<Skeleton className="h-9 w-36" />
			</div>
			<KpiFiguresSkeleton count={KPI_COUNT} className={BAND_CLASS} />
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Card className="@4xl/main:col-span-2">
					<CardHeader>
						<Skeleton className="h-5 w-32" />
					</CardHeader>
					<CardContent className="grid gap-4">
						<Skeleton className="h-9 w-48" />
						<Skeleton className="h-72 w-full" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-48" />
					</CardHeader>
					<CardContent className="grid gap-1.5">
						{["1", "2", "3", "4", "5"].map((key) => (
							<Skeleton key={key} className="h-9 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-36" />
				</CardHeader>
				<CardContent className="grid gap-3">
					{["1", "2", "3", "4", "5", "6"].map((key) => (
						<Skeleton key={key} className="h-10 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the page when a loader fails. The route sets it as errorComponent. */
export function OverviewPageError() {
	const { t } = useT();
	return <PageError message={t("overview.loadError")} />;
}
