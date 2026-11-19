// The home behind login, in the four bands of the kit e-commerce dashboard: the best day and three stat cards,
// the monthly and daily revenue charts, the region, category, and delivery cards, then the orders and best sellers tables.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. Every card except "Revenue by month" reads the summary of that period.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { orderCsvColumns, ordersQueryOptions } from "~/features/orders";
import {
	dayCountFormat,
	downloadCsv,
	fillMessage,
	moneyFormat,
	type PeriodDays,
	PeriodSelect,
	shipByOf,
	startOfLocalDay,
	toCsv,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { DEFAULT_DAYS, overviewQueryOptions } from "../api/overview.queries";
import { isInPeriod } from "../lib/summary";
import { BestDayCard } from "./best-day-card";
import { BestSellersCard } from "./best-sellers-card";
import { CategorySalesCard } from "./category-sales-card";
import { DeliveryTimeCard } from "./delivery-time-card";
import { RecentOrdersCard } from "./recent-orders-card";
import { RegionSalesCard } from "./region-sales-card";
import { RevenueMixCard } from "./revenue-mix-card";
import { RevenueTrendCard } from "./revenue-trend-card";
import { StatCard } from "./stat-card";

/** Four bands of cards on a wide page. One column on a phone. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...overviewQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const periodText = dayCountFormat(locale).format(days);
	// The figures cover full days. The last one is yesterday: one millisecond before today starts.
	const lastFullDay = new Date(startOfLocalDay(now) - 1);
	const longDay = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		month: "long",
		day: "numeric",
	});
	// The orders of the period, the newest first: the list query sorts them so.
	const periodOrders = orders.filter((order) =>
		isInPeriod(order.placedAt, days, now),
	);
	// The same order as the "To ship" tab of the order list: the earliest ship-by time first.
	const nextOrder =
		orders
			.filter((order) => order.status === "to_ship")
			.sort((first, second) => shipByOf(first) - shipByOf(second))[0] ?? null;

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					period: periodText,
					date: longDay.format(lastFullDay),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							disabled={periodOrders.length === 0}
							onClick={() =>
								downloadCsv(
									"orders.csv",
									toCsv(periodOrders, orderCsvColumns(t, locale)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			{summary.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border p-6">
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
						<BestDayCard
							bestDay={summary.data.bestDay}
							periodText={periodText}
							className="@4xl/main:col-span-4"
						/>
						<div className="@4xl/main:col-span-8 grid @xl/main:grid-cols-3 gap-4">
							<StatCard
								label={t("overview.stats.orders")}
								value={number.format(summary.data.orders.value)}
								change={summary.data.orders.change}
								goodWhen="up"
								to="/app/orders"
							/>
							<StatCard
								label={t("overview.stats.averageOrder")}
								value={money.format(summary.data.averageOrder.value)}
								change={summary.data.averageOrder.change}
								goodWhen="up"
								to="/app/orders"
							/>
							<StatCard
								label={t("overview.stats.returning")}
								value={percent.format(summary.data.returningShare.value)}
								change={summary.data.returningShare.change}
								goodWhen="up"
								to="/app/customers"
							/>
						</div>
					</div>
					<div className="grid @4xl/main:grid-cols-2 gap-4">
						<RevenueMixCard months={summary.data.months} />
						<RevenueTrendCard
							points={summary.data.revenueDaily}
							revenue={summary.data.revenue}
						/>
					</div>
					{/* Two columns on a mid width with the delivery card under both, three columns from the xl width. */}
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-12 gap-4">
						<RegionSalesCard
							areas={summary.data.areas}
							periodText={periodText}
							className="@4xl/main:col-span-4"
						/>
						<CategorySalesCard
							slices={summary.data.categories}
							className="@4xl/main:col-span-3"
						/>
						<DeliveryTimeCard
							delivery={summary.data.delivery}
							nextOrder={nextOrder}
							periodText={periodText}
							className="@2xl/main:col-span-2 @4xl/main:col-span-5"
						/>
					</div>
					<div className="grid @4xl/main:grid-cols-12 gap-4">
						<RecentOrdersCard
							orders={periodOrders}
							className="@4xl/main:col-span-7"
						/>
						<BestSellersCard
							products={summary.data.bestSellers}
							className="@4xl/main:col-span-5"
						/>
					</div>
				</>
			)}
		</div>
	);
}

// Placeholder keys of the stat cards and the middle cards. Fixed keys, because the cards never reorder.
const SKELETON_STATS = ["1", "2", "3"];
const SKELETON_MIDDLE = ["1", "2", "3"];

// Every band while the summary of a new period loads for the first time.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-12 gap-4">
				<Skeleton className="@4xl/main:col-span-4 h-48" />
				<div className="@4xl/main:col-span-8 grid @xl/main:grid-cols-3 gap-4">
					{SKELETON_STATS.map((key) => (
						<Skeleton key={key} className="h-48" />
					))}
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-2 gap-4">
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
			</div>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
				{SKELETON_MIDDLE.map((key) => (
					<Skeleton key={key} className="h-112" />
				))}
			</div>
			<Skeleton className="h-128" />
		</>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<SummarySkeleton />
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
