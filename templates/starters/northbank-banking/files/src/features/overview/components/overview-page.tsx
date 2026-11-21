// The home behind login. Top: the title, the period, and the export. Then the notice, four KPI tiles,
// three cards (card limits, cash flow, spending), and the transactions card beside the balance history.
// The /app route renders it after its loader. The page holds the period; the KPIs and the spending card read it.
import {
	ArrowCircleDownIcon,
	ArrowCircleUpIcon,
	CreditCardIcon,
	DownloadSimpleIcon,
	FileTextIcon,
	PaperPlaneTiltIcon,
	WalletIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CUSTOMER_NAME,
	centsToUnits,
	countLabel,
	dayFormat,
	daysBetween,
	dayToDate,
	downloadCsv,
	fillMessage,
	moneyFormat,
	NEAR_LIMIT_SHARE,
	type PeriodDays,
	PeriodSelect,
	toCsv,
	todayIsoDay,
} from "~/features/bank";
import { cardsQueryOptions } from "~/features/cards";
import {
	transactionCsvColumns,
	transactionsQueryOptions,
} from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewSummaryQueryOptions } from "../api/overview.queries";
import { AttentionBanner } from "./attention-banner";
import { BalanceHistoryCard } from "./balance-history-card";
import { CardLimitsCard } from "./card-limits-card";
import { CashFlowCard } from "./cash-flow-card";
import { KpiTileCard } from "./kpi-tile-card";
import { RecentEntriesCard } from "./recent-entries-card";
import { SpendingCard } from "./spending-card";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const CardSpendBars = lazy(() =>
	import("./card-spend-bars").then((module) => ({
		default: module.CardSpendBars,
	})),
);

/** The period of the first load. The loader prefetches it. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** Bands of the kit finance and payment pages. One column on a phone, two at a mid width, the kit grid at full width. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: rows } = useSuspenseQuery(transactionsQueryOptions());
	const { data: cards } = useSuspenseQuery(cardsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old figures until it is ready.
	const summary = useQuery({
		...overviewSummaryQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const today = todayIsoDay();
	const money = moneyFormat(locale, 0);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const periodLabel = fillMessage(t("period.last"), {
		period: dayCount.format(days),
	});
	const vsBefore = fillMessage(t("overview.vsBefore"), {
		period: dayCount.format(days),
	});
	const nearLimit = cards.filter(
		(item) =>
			item.status === "active" &&
			item.monthSpendCents >= item.card.monthlyLimitCents * NEAR_LIMIT_SHARE,
	).length;

	function exportPeriod() {
		const periodRows = rows.filter((row) => daysBetween(row.day, today) < days);
		downloadCsv(
			`northbank-entries-${days}d.csv`,
			toCsv(periodRows, transactionCsvColumns(t)),
		);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					customer: CUSTOMER_NAME,
					period: periodLabel,
					today: dayFormat(locale, "long").format(dayToDate(today)),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							size="icon"
							aria-label={t("common.exportCsv")}
							onClick={exportPeriod}
						>
							<DownloadSimpleIcon />
						</Button>
					</>
				}
			/>
			<AttentionBanner rows={rows} days={days} />
			{summary.isError ? (
				<div className="grid justify-items-start gap-3 rounded-(--surface-radius) border p-6">
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
					<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
						<KpiTileCard
							icon={WalletIcon}
							label={t("overview.kpis.balance")}
							value={money.format(centsToUnits(summary.data.balance.cents))}
							change={summary.data.balance.change}
							goodWhen="up"
							context={vsBefore}
						>
							<div className="flex gap-2 px-6">
								<Button size="sm" className="grow" asChild>
									<Link to="/app/payees">
										<PaperPlaneTiltIcon />
										{t("overview.kpis.pay")}
									</Link>
								</Button>
								<Button size="sm" variant="outline" className="grow" asChild>
									<Link to="/app/statements">
										<FileTextIcon />
										{t("statements.title")}
									</Link>
								</Button>
							</div>
						</KpiTileCard>
						<KpiTileCard
							icon={ArrowCircleDownIcon}
							label={t("overview.kpis.moneyIn")}
							value={money.format(centsToUnits(summary.data.moneyIn.cents))}
							change={summary.data.moneyIn.change}
							goodWhen="up"
							context={vsBefore}
						/>
						<KpiTileCard
							icon={ArrowCircleUpIcon}
							label={t("overview.kpis.moneyOut")}
							value={money.format(centsToUnits(summary.data.moneyOut.cents))}
							change={summary.data.moneyOut.change}
							goodWhen="down"
							context={vsBefore}
						/>
						<KpiTileCard
							icon={CreditCardIcon}
							label={t("overview.kpis.cardSpend")}
							badge={
								nearLimit > 0 ? (
									<Badge variant="destructive">
										{countLabel(
											nearLimit,
											t("overview.kpis.nearOne"),
											t("overview.kpis.nearOther"),
											locale,
										)}
									</Badge>
								) : null
							}
							value={money.format(centsToUnits(summary.data.cardSpend.cents))}
							change={summary.data.cardSpend.change}
							goodWhen="down"
							context={vsBefore}
							isFlush
						>
							<Suspense fallback={<Skeleton className="h-14 w-full" />}>
								<CardSpendBars points={summary.data.cardSpendByDay} />
							</Suspense>
						</KpiTileCard>
					</div>
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
						<CardLimitsCard summaries={cards} />
						<CashFlowCard />
						<SpendingCard
							spending={summary.data.spending}
							periodLabel={periodLabel}
						/>
					</div>
				</>
			)}
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<div className="@4xl/main:col-span-2 grid">
					<RecentEntriesCard rows={rows} />
				</div>
				<BalanceHistoryCard />
			</div>
		</div>
	);
}

// Placeholder keys of the KPI row and the middle grid. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_CARDS = ["1", "2", "3"];

// The KPI row and the middle grid while the summary loads.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-44" />
				))}
			</div>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-120" />
				))}
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
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-56 max-w-full" />
			</div>
			<Skeleton className="h-14" />
			<SummarySkeleton />
			<Skeleton className="h-120" />
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
