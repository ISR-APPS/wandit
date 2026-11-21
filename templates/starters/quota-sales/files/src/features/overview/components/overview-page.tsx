// The home of Quota: the period and the download in the header,
// the bookings chart beside 4 stat cards, then the top reps beside the order status card.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The chart and the stat cards read the summary of that period.
import {
	CoinsIcon,
	DownloadSimpleIcon,
	PackageIcon,
	ReceiptIcon,
	TargetIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { ordersQueryOptions } from "~/features/orders";
import { repsQueryOptions } from "~/features/reps";
import {
	CURRENCY,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	localDateTimeOf,
	moneyFormat,
	PageError,
	PanelError,
	type PeriodDays,
	PeriodSelect,
	percentFormat,
	toCsv,
	todayDayNumber,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DEFAULT_DAYS,
	type OverviewStat,
	type OverviewStatId,
	overviewQueryOptions,
	type YearPoint,
} from "../api/overview.queries";
import { BookingsChartCard } from "./bookings-chart-card";
import { OrderStatusCard } from "./order-status-card";
import { StatCard } from "./stat-card";
import { TopRepsCard } from "./top-reps-card";

// The top reps card lists 6 reps, as many rows as the order table beside it.
const TOP_REPS = 6;

// The icon of each stat tile.
const STAT_ICONS = {
	bookings: CoinsIcon,
	averageOrder: ReceiptIcon,
	orders: PackageIcon,
	attainment: TargetIcon,
} satisfies Record<OverviewStatId, KitIcon>;

/** Two bands: the chart with the stats, then the top reps with the order status. One column on a phone. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const { data: board } = useSuspenseQuery(repsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...overviewQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const period = dayCountFormat(locale).format(days);
	// The chart and the stats stop at the last closed day, so the description names yesterday.
	const lastDay = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(localDateTimeOf(todayDayNumber() - 1, 0));

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					period,
					lastDay,
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.download")}
							disabled={summary.data === undefined}
							onClick={() =>
								summary.data &&
								downloadCsv(
									`bookings-${days}-days.csv`,
									toCsv(
										summary.data.points.map((point) => ({
											...point,
											id: point.day,
										})),
										bookingCsvColumns(t),
									),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.download")}</span>
						</Button>
					</>
				}
			/>
			{summary.isError ? (
				<Card>
					<PanelError
						message={t("overview.summaryError")}
						onRetry={() => summary.refetch()}
						className="h-64"
					/>
				</Card>
			) : summary.data === undefined ? (
				<FirstBandSkeleton />
			) : (
				<div className="grid @3xl/main:grid-cols-2 gap-4">
					<BookingsChartCard
						points={summary.data.points}
						periodLabel={fillMessage(t("overview.chart.description"), {
							period,
						})}
					/>
					<div className="grid @xl/main:grid-cols-2 gap-4">
						{summary.data.stats.map((stat) => (
							<StatCard
								key={stat.id}
								label={t(`overview.stats.${stat.id}`)}
								value={formatStat(stat, locale)}
								change={stat.change}
								changeKind={stat.changeKind}
								context={
									stat.id === "attainment"
										? t("overview.vsLastQuarter")
										: fillMessage(t("overview.vsBefore"), { period })
								}
								icon={STAT_ICONS[stat.id]}
							/>
						))}
					</div>
				</div>
			)}
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<TopRepsCard
					reps={board.reps.slice(0, TOP_REPS)}
					quarterLabel={board.quarterLabel}
				/>
				<div className="@4xl/main:col-span-2 min-w-0">
					<OrderStatusCard orders={orders} />
				</div>
			</div>
		</div>
	);
}

// The text of one stat value: an amount, a count, or a percent.
function formatStat(stat: OverviewStat, locale: string): string {
	const format =
		stat.id === "attainment"
			? percentFormat(locale)
			: stat.id === "orders"
				? new Intl.NumberFormat(locale)
				: moneyFormat(locale);
	return format.format(stat.value);
}

// The columns of the bookings download: the day and the two years, as plain numbers.
function bookingCsvColumns(t: ReturnType<typeof useT>["t"]) {
	return [
		{ header: t("overview.csv.day"), value: (point: YearPoint) => point.day },
		{
			header: `${t("overview.chart.thisYear")} (${CURRENCY})`,
			value: (point: YearPoint) => String(point.thisYear),
		},
		{
			header: `${t("overview.chart.lastYear")} (${CURRENCY})`,
			value: (point: YearPoint) => String(point.lastYear),
		},
	];
}

// Placeholder keys of the stat grid. Fixed keys, because the cards never reorder.
const SKELETON_STATS = ["1", "2", "3", "4"];

// The chart and the stat grid while a period loads.
function FirstBandSkeleton() {
	return (
		<div className="grid @3xl/main:grid-cols-2 gap-4">
			<Skeleton className="h-80" />
			<div className="grid @xl/main:grid-cols-2 gap-4">
				{SKELETON_STATS.map((key) => (
					<Skeleton key={key} className="h-36" />
				))}
			</div>
		</div>
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
			<FirstBandSkeleton />
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-144" />
				<Skeleton className="@4xl/main:col-span-2 h-144" />
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	return <PageError message={t("overview.loadError")} />;
}
