// The home behind login, in the four bands of the kit commerce dashboard:
// the most picked item and 3 figures; stock in and out and the picks line; picks by family, value by family,
// and the delivery record; then the recent purchase orders and the low stock items.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The summary query and the order table read it.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { itemCsvColumns, itemsQueryOptions } from "~/features/items";
import { purchaseOrdersQueryOptions } from "~/features/purchase-orders";
import {
	addLocalDays,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	moneyFormat,
	type PeriodDays,
	PeriodSelect,
	startOfLocalDay,
	toCsv,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { ArrowRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	OVERVIEW_DEFAULT_DAYS,
	overviewQueryOptions,
} from "../api/overview.queries";
import { DeliveryRecordCard } from "./delivery-record-card";
import { FamilyPicksCard } from "./family-picks-card";
import { FlowCard } from "./flow-card";
import { LowStockCard } from "./low-stock-card";
import { PicksCard } from "./picks-card";
import { RecentOrdersCard } from "./recent-orders-card";
import { StatCard } from "./stat-card";
import { TopItemCard } from "./top-item-card";
import { ValueCard } from "./value-card";

/** Four bands, as the kit: 4/12 + 8/12, 1/2 + 1/2, 4/12 + 3/12 + 5/12, 7/12 + 5/12. One column on a phone. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(OVERVIEW_DEFAULT_DAYS);
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...overviewQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const { data: items } = useSuspenseQuery(itemsQueryOptions());
	const { data: orders } = useSuspenseQuery(purchaseOrdersQueryOptions());
	const now = Date.now();
	const periodStart = addLocalDays(startOfLocalDay(now), -days);
	const money = moneyFormat(locale, true);
	const number = new Intl.NumberFormat(locale);
	const dayCount = dayCountFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const period = dayCount.format(days);
	// The item list is the most urgent first, so the low stock table starts with the empty shelves.
	const lowItems = items.filter((item) => item.status !== "ok");
	const recentOrders = orders.filter(
		(order) => Date.parse(order.createdAt) >= periodStart,
	);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("period.description"), {
					period,
					today: today.format(now),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("overview.exportStock")}
							onClick={() =>
								downloadCsv(
									"stock-on-hand.csv",
									toCsv(items, itemCsvColumns(t, locale)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">
								{t("overview.exportStock")}
							</span>
						</Button>
					</>
				}
			/>
			{summary.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border bg-card p-6">
					<p className="text-sm" role="alert">
						{t("overview.summaryError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => summary.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : summary.data === undefined ? (
				<SummarySkeleton />
			) : (
				<>
					<div className="grid @4xl/main:grid-cols-12 gap-4">
						<TopItemCard
							item={summary.data.topItem}
							period={period}
							className="@4xl/main:col-span-4"
						/>
						<div className="@4xl/main:col-span-8 grid @xl/main:grid-cols-3 gap-4">
							<StatCard
								label={t("overview.stockValue")}
								value={money.format(summary.data.stockValue.value)}
								figure={summary.data.stockValue}
								// A rise can be a restock or slow stock, so the change has no color.
								goodWhen="neutral"
								footer={
									<Link to="/app/items">
										{t("overview.viewItems")}
										<ArrowRightIcon className="rtl:rotate-180" />
									</Link>
								}
							/>
							<StatCard
								label={t("overview.lowStock")}
								value={number.format(summary.data.lowStock.value)}
								figure={summary.data.lowStock}
								goodWhen="down"
								footer={
									<Link to="/app/items" search={{ status: "low" }}>
										{t("overview.viewLow")}
										<ArrowRightIcon className="rtl:rotate-180" />
									</Link>
								}
							/>
							<StatCard
								label={t("overview.openOrders")}
								value={number.format(summary.data.openOrders.value)}
								figure={summary.data.openOrders}
								goodWhen="neutral"
								footer={
									<Link to="/app/purchase-orders">
										{t("overview.viewOrders")}
										<ArrowRightIcon className="rtl:rotate-180" />
									</Link>
								}
							/>
						</div>
					</div>
					<div className="grid @4xl/main:grid-cols-2 gap-4">
						<FlowCard flow={summary.data.flow} period={period} />
						<PicksCard
							points={summary.data.picks}
							unitsPicked={summary.data.unitsPicked}
						/>
					</div>
					<div className="grid @3xl/main:grid-cols-12 gap-4">
						<FamilyPicksCard
							families={summary.data.families}
							period={period}
							className="@3xl/main:col-span-6 @5xl/main:col-span-4"
						/>
						<ValueCard
							values={summary.data.valueByFamily}
							className="@3xl/main:col-span-6 @5xl/main:col-span-3"
						/>
						<DeliveryRecordCard
							deliveries={summary.data.deliveries}
							now={now}
							className="@3xl/main:col-span-12 @5xl/main:col-span-5"
						/>
					</div>
				</>
			)}
			<div className="grid @4xl/main:grid-cols-12 gap-4">
				<RecentOrdersCard
					orders={recentOrders}
					period={period}
					className="@4xl/main:col-span-7"
				/>
				<LowStockCard items={lowItems} className="@4xl/main:col-span-5" />
			</div>
		</div>
	);
}

// The first three bands while the summary of a period loads.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-12 gap-4">
				<Skeleton className="@4xl/main:col-span-4 h-48" />
				<Skeleton className="@4xl/main:col-span-8 h-48" />
			</div>
			<div className="grid @4xl/main:grid-cols-2 gap-4">
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
			</div>
			<div className="grid @3xl/main:grid-cols-12 gap-4">
				<Skeleton className="@3xl/main:col-span-6 @5xl/main:col-span-4 h-112" />
				<Skeleton className="@3xl/main:col-span-6 @5xl/main:col-span-3 h-112" />
				<Skeleton className="@3xl/main:col-span-12 @5xl/main:col-span-5 h-112" />
			</div>
		</>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<SummarySkeleton />
			<Skeleton className="h-112" />
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
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
