// The sales home behind login, in the band layout of the kit sales page.
// Band 1: the sales chart (half) and 4 stat cards in a 2 x 2 grid (half). Band 2: best sellers (1/3) and the check card (2/3).
// The /app route renders it after its loader. The period select drives the chart and the header download.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	dayTotalsQueryOptions,
	downloadCsv,
	fillMessage,
	floorQueryOptions,
	ordersQueryOptions,
	toCsv,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { salesByDayQueryOptions } from "../api/dashboard.queries";
import {
	buildCheckSteps,
	buildStats,
	buildTopDishes,
	DEFAULT_DAYS,
	type PeriodDays,
} from "../lib/dashboard";
import { BestSellersCard } from "./best-sellers-card";
import { CheckStatusCard } from "./check-status-card";
import { PeriodSelect } from "./period-select";
import { SalesChartCard } from "./sales-chart-card";
import { StatCard } from "./stat-card";

// The kit list shows 6 best sellers: enough to fill the height of the check card beside it.
const TOP_DISH_COUNT = 6;

/** The page reads the cached queries of its loader. The stat cards join today's totals with the floor board. */
export function DashboardPage() {
	const { t, locale } = useT();
	const queryClient = useQueryClient();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: totals } = useSuspenseQuery(dayTotalsQueryOptions());
	const { data: board } = useSuspenseQuery(floorQueryOptions());
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const stats = buildStats(totals.today, totals.lastWeek, board);
	const dateFormat = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	// The download reads the chart query of the period, so the file holds the bars on the screen.
	async function downloadPeriod() {
		const sales = await queryClient.fetchQuery(salesByDayQueryOptions(days));
		downloadCsv(
			`sales-${days}-days.csv`,
			toCsv(
				sales.points.map((point) => ({ id: point.day, ...point })),
				[
					{ header: t("dashboard.day"), value: (row) => row.day },
					// A plain number with a dot, so every spreadsheet reads it as a number. Cents become euros here.
					{
						header: t("dashboard.sales"),
						value: (row) => (row.salesCents / 100).toFixed(2),
					},
					{ header: t("dashboard.covers"), value: (row) => String(row.covers) },
				],
			),
		);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("dashboard.title")}
				description={fillMessage(t("dashboard.description"), {
					date: dateFormat.format(new Date()),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("dashboard.download")}
							onClick={downloadPeriod}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">
								{t("dashboard.download")}
							</span>
						</Button>
					</>
				}
			/>
			<div className="grid @4xl/main:grid-cols-2 gap-4">
				{/* A period change loads the new bars here. The rest of the page stays on the screen. */}
				<Suspense fallback={<Skeleton className="h-80 rounded-surface" />}>
					<SalesChartCard days={days} />
				</Suspense>
				<div className="grid @xl/main:grid-cols-2 gap-4">
					{stats.map((stat) => (
						<StatCard key={stat.id} stat={stat} />
					))}
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<BestSellersCard dishes={buildTopDishes(orders, TOP_DISH_COUNT)} />
				<div className="@4xl/main:col-span-2">
					<CheckStatusCard steps={buildCheckSteps(orders)} orders={orders} />
				</div>
			</div>
		</div>
	);
}

// Placeholder cards of the skeleton. Fixed keys, because they never reorder.
const SKELETON_STATS = ["sales", "checks", "average", "tables"];

/** Placeholder while the /app loader runs: the header and the two bands. */
export function DashboardPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-2 gap-4">
				<Skeleton className="h-80 rounded-surface" />
				<div className="grid @xl/main:grid-cols-2 gap-4">
					{SKELETON_STATS.map((key) => (
						<Skeleton key={key} className="h-36 rounded-surface" />
					))}
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-96 rounded-surface" />
				<Skeleton className="@4xl/main:col-span-2 h-96 rounded-surface" />
			</div>
		</div>
	);
}

/** Error state of the home when its loader fails. Try again runs the loader again. */
export function DashboardPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("dashboard.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
