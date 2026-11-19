// The home behind login, in the band order of the kit finance page: the header with the period and the export,
// four KPI tiles, the income, monthly expenses, and spending cards, then the transactions beside the budget and the accounts.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The KPIs, the income card, and the spending card read the summary of that period.
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChartLineUpIcon,
	CreditCardIcon,
	DownloadSimpleIcon,
	ReceiptIcon,
	WalletIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { accountsQueryOptions } from "~/features/accounts";
import { PageHeader } from "~/features/app-shell";
import { budgetReportQueryOptions } from "~/features/budgets";
import {
	addDays,
	ChangeLine,
	dayCountFormat,
	dayFormat,
	dayToDate,
	downloadCsv,
	fillMessage,
	MoneyText,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/ledger";
import {
	transactionCsvColumns,
	transactionsQueryOptions,
} from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { KpiTile } from "~/shared/ui/kpi-tile";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewQueryOptions } from "../api/overview.queries";
import { AccountsWalletCard } from "./accounts-wallet-card";
import { BudgetGoalCard } from "./budget-goal-card";
import { IncomeSourcesCard } from "./income-sources-card";
import { MonthlyExpensesCard } from "./monthly-expenses-card";
import { RecentTransactionsCard } from "./recent-transactions-card";
import { SpendingCard } from "./spending-card";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const CardDebtBars = lazy(() =>
	import("./card-debt-bars").then((module) => ({
		default: module.CardDebtBars,
	})),
);

/** The period that the loader prefetches and that the page shows first, in days. */
export const DEFAULT_DAYS: PeriodDays = 30;

// The transactions card shows this many of the newest entries, as the kit card does.
const RECENT_COUNT = 7;

// Above this share of the card limit, the card badge turns red.
// Lenders read a card used above half its limit as a credit risk, so half is the warning mark.
const CARD_ALERT_SHARE = 0.5;

/** Three bands of cards under the header. One column on a phone, two at a mid width, the kit grid at full width. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());
	const { data: budget } = useSuspenseQuery(
		budgetReportQueryOptions("current"),
	);
	const { data: accounts } = useSuspenseQuery(accountsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...overviewQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const dayCount = dayCountFormat(locale);
	const shortDay = dayFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const vsBefore = fillMessage(t("overview.vsBefore"), {
		period: dayCount.format(days),
	});

	function exportPeriod() {
		const start = summary.data?.periodStart;
		// `YYYY-MM-DD` texts compare in date order.
		const rows = start
			? transactions.filter((row) => row.day >= start)
			: transactions;
		downloadCsv("transactions.csv", toCsv(rows, transactionCsvColumns(t)));
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("period.description"), {
					period: dayCount.format(days),
					today: today.format(Date.now()),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							size="icon"
							aria-label={t("overview.exportPeriod")}
							onClick={exportPeriod}
						>
							<DownloadSimpleIcon />
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
					<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
						<KpiTile label={t("overview.cashBalance")} icon={WalletIcon}>
							<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
								<MoneyText
									amountCents={summary.data.cash.valueCents}
									withCents={false}
									className="text-3xl"
								/>
								<p className="grid text-sm">
									<ChangeLine
										change={summary.data.cash.change}
										goodWhen="up"
										className="text-sm"
									/>
									<span className="text-muted-foreground">
										{fillMessage(t("overview.since"), {
											day: shortDay.format(
												dayToDate(addDays(summary.data.periodStart, -1)),
											),
										})}
									</span>
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button asChild className="grow">
									<Link to="/app/transactions" search={{ type: "income" }}>
										<ArrowDownIcon />
										{t("overview.moneyIn")}
									</Link>
								</Button>
								<Button asChild variant="outline" className="grow">
									<Link to="/app/transactions" search={{ type: "expense" }}>
										<ArrowUpIcon />
										{t("overview.moneyOut")}
									</Link>
								</Button>
							</div>
						</KpiTile>
						<KpiTile label={t("overview.netProfit")} icon={ChartLineUpIcon}>
							<MoneyText
								amountCents={summary.data.netProfit.valueCents}
								withCents={false}
								className="text-3xl"
							/>
							<p className="flex flex-wrap items-center gap-x-1 text-sm">
								<ChangeLine
									change={summary.data.netProfit.change}
									goodWhen="up"
									className="text-sm"
								/>
								<span className="text-muted-foreground">{vsBefore}</span>
							</p>
						</KpiTile>
						<KpiTile label={t("overview.expenses")} icon={ReceiptIcon}>
							<MoneyText
								amountCents={summary.data.expenses.valueCents}
								withCents={false}
								className="text-3xl"
							/>
							<p className="flex flex-wrap items-center gap-x-1 text-sm">
								<ChangeLine
									change={summary.data.expenses.change}
									goodWhen="down"
									className="text-sm"
								/>
								<span className="text-muted-foreground">{vsBefore}</span>
							</p>
						</KpiTile>
						<KpiTile
							label={t("overview.cardDebt")}
							icon={CreditCardIcon}
							badge={
								summary.data.cardLimitCents > 0 ? (
									<Badge
										variant={
											summary.data.cardDebt.valueCents /
												summary.data.cardLimitCents >
											CARD_ALERT_SHARE
												? "destructive"
												: "secondary"
										}
									>
										{fillMessage(t("overview.ofLimit"), {
											share: percent.format(
												summary.data.cardDebt.valueCents /
													summary.data.cardLimitCents,
											),
										})}
									</Badge>
								) : null
							}
							chart={
								<Suspense fallback={<Skeleton className="h-14 w-full" />}>
									<CardDebtBars points={summary.data.cardDebtByDay} />
								</Suspense>
							}
						>
							<MoneyText
								amountCents={summary.data.cardDebt.valueCents}
								withCents={false}
								className="text-3xl"
							/>
						</KpiTile>
					</div>
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
						<IncomeSourcesCard
							income={summary.data.income}
							sources={summary.data.incomeSources}
							paymentCount={summary.data.incomeCount}
							deltaContext={vsBefore}
						/>
						<MonthlyExpensesCard />
						{/* In the 2-column band the third card takes the full row, so no card stands alone. */}
						<div className="@2xl/main:col-span-2 @4xl/main:col-span-1 grid">
							<SpendingCard
								spending={summary.data.spending}
								periodStart={summary.data.periodStart}
								periodEnd={summary.data.periodEnd}
							/>
						</div>
					</div>
				</>
			)}
			<div className="grid @3xl/main:grid-cols-2 items-start gap-4">
				<RecentTransactionsCard rows={transactions.slice(0, RECENT_COUNT)} />
				<div className="grid gap-4">
					<BudgetGoalCard
						spentCents={budget.spentCents}
						budgetedCents={budget.budgetedCents}
						monthStart={budget.monthStart}
					/>
					<AccountsWalletCard accounts={accounts.accounts} />
				</div>
			</div>
		</div>
	);
}

// Placeholder keys of the KPI row and the middle band. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_CARDS = ["1", "2", "3"];

// The KPI row and the middle band while the summary loads.
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
			<SummarySkeleton />
			<div className="grid @3xl/main:grid-cols-2 gap-4">
				<Skeleton className="h-112" />
				<Skeleton className="h-112" />
			</div>
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
