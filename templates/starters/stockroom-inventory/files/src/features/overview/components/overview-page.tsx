// The home of the stockroom (main-rail): a wide main column and a narrow sticky rail of the work for today.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// Main column: picks per day and the newest movements. Rail: needs attention, the figures, and the deliveries to come.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	itemsQueryOptions,
	latestStockChangesQueryOptions,
} from "~/features/items";
import { purchaseOrdersQueryOptions } from "~/features/purchase-orders";
import {
	DailyUnitsCardSkeleton,
	isOpenOrderStatus,
	LoadError,
	type PeriodDays,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	LATEST_MOVEMENT_COUNT,
	OVERVIEW_DAYS,
	overviewKpisQueryOptions,
} from "../api/overview.queries";
import { buildAttentionRows } from "../lib/attention";
import { DueNextCard } from "./due-next-card";
import { FiguresCard, FiguresCardSkeleton } from "./figures-card";
import { LatestMovementsCard } from "./latest-movements-card";
import { NeedsAttentionCard } from "./needs-attention-card";
import { PicksTrendCard } from "./picks-trend-card";

/** The page holds the period of the trend. Every other panel reads the loader cache. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(OVERVIEW_DAYS);
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: items } = useSuspenseQuery(itemsQueryOptions());
	const { data: orders } = useSuspenseQuery(purchaseOrdersQueryOptions());
	const { data: movements } = useSuspenseQuery(
		latestStockChangesQueryOptions(LATEST_MOVEMENT_COUNT),
	);

	const attentionRows = buildAttentionRows(items, orders);
	// LIMIT: reads the newest 1,000 rows. Upgrade: a query of the open rows by due date.
	const dueNext = orders
		.filter((order) => isOpenOrderStatus(order.status) && order.lateDays === 0)
		.sort(
			(first, second) =>
				Date.parse(first.expectedOn) - Date.parse(second.expectedOn),
		);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date());

	return (
		<div className="grid gap-6">
			<div className="grid gap-1">
				<h1 className="font-(--heading-weight) font-display text-2xl tracking-(--heading-tracking)">
					{t("overview.title")}
				</h1>
				<p className="text-muted-foreground text-sm">{`${t("overview.site")} · ${today}`}</p>
			</div>
			{/* From 56rem: main column at the start, rail at the end (18rem, then 20rem from 72rem). Below: one column, rail first. */}
			{/* From 42rem to 56rem the rail splits in two columns, so the chart stays near the top. */}
			<div className="grid @4xl/main:grid-cols-[minmax(0,1fr)_18rem] @6xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				{/* top-20: under the h-14 app header, with the gap of the page padding. */}
				{/* content-start and items-start: each card keeps its own height in the two-column rail. */}
				{/* In the two-column rail, attention fills the first column, and the figures and due next stack in the second. */}
				<div className="@4xl/main:sticky @4xl/main:top-20 @4xl/main:col-start-2 @4xl/main:row-start-1 grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-1 content-start items-start gap-3">
					<div className="@2xl/main:row-span-2 @4xl/main:row-span-1">
						<NeedsAttentionCard rows={attentionRows} />
					</div>
					<FiguresCard
						items={kpis.map((kpi) => ({ ...kpi, label: t(kpi.labelKey) }))}
					/>
					<DueNextCard orders={dueNext} />
				</div>
				<div className="@4xl/main:col-start-1 @4xl/main:row-start-1 flex min-w-0 flex-col @3xl/main:gap-6 gap-4">
					<PicksTrendCard days={days} onDaysChange={setDays} />
					<LatestMovementsCard movements={movements} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the home loader runs: the main column and the rail in their final shape. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
			</div>
			<div className="grid @4xl/main:grid-cols-[minmax(0,1fr)_18rem] @6xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-start-2 @4xl/main:row-start-1 flex flex-col gap-4">
					<Skeleton className="h-72 rounded-surface" />
					<FiguresCardSkeleton />
					<Skeleton className="h-56 rounded-surface" />
				</div>
				<div className="@4xl/main:col-start-1 @4xl/main:row-start-1 flex min-w-0 flex-col @3xl/main:gap-6 gap-4">
					<DailyUnitsCardSkeleton />
					<Card>
						<CardContent className="grid gap-3">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-64 w-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

/** Error state of the home when its loader fails. */
export function OverviewPageError() {
	const { t } = useT();
	return <LoadError message={t("overview.loadError")} />;
}
