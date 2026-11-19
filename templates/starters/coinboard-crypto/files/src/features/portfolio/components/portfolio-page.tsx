// The home of the app, in the kit crypto anatomy: a title row with an export, then two bands.
// Band 1: the overview, the top holdings, and the trade form. A wide page shows the 3 cards in one row.
// Like the kit at lg, a medium page shows the overview on its own row and the other two cards side by side.
// Band 2 (1/3 + 2/3): the recent activity, and the balance of each account over time.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { transactionsQueryOptions } from "~/features/activity";
import { PageHeader } from "~/features/app-shell";
import { positionCsvColumns, positionsQueryOptions } from "~/features/holdings";
import { downloadCsv, fillMessage, toCsv } from "~/features/ledger";
import { assetsQueryOptions } from "~/features/markets";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { portfolioSummaryQueryOptions } from "../api/portfolio.queries";
import { BalanceSummaryCard } from "./balance-summary-card";
import { OverviewCard } from "./overview-card";
import { RecentActivityCard } from "./recent-activity-card";
import { TopHoldingsCard } from "./top-holdings-card";
import { TradeCard } from "./trade-card";

// One column under 42rem of page width. From 42rem (a 1024 px window), band 1 has 2 columns under a full-width overview.
const TOP_BAND_GRID = "grid gap-4 @2xl/main:grid-cols-2 @4xl/main:grid-cols-3";
const OVERVIEW_SPAN = "@2xl/main:col-span-2 @4xl/main:col-span-1";
// From 56rem, band 1 has 3 equal cards and band 2 splits 1/3 and 2/3.
const BAND_GRID = "grid gap-4 @4xl/main:grid-cols-3";
const WIDE_SPAN = "@4xl/main:col-span-2";

/** The home page. Every card reads the caches that the /app loader filled. */
export function PortfolioPage() {
	const { t, locale } = useT();
	const { data: summary } = useSuspenseQuery(portfolioSummaryQueryOptions());
	const { data: positions } = useSuspenseQuery(positionsQueryOptions());
	const { data: assets } = useSuspenseQuery(assetsQueryOptions());
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date());

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("portfolio.title")}
				description={fillMessage(t("portfolio.description"), { today })}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv(
								"holdings.csv",
								toCsv(positions, positionCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<div className={TOP_BAND_GRID}>
				<div className={OVERVIEW_SPAN}>
					<OverviewCard summary={summary} />
				</div>
				<TopHoldingsCard positions={positions} />
				<TradeCard
					assets={assets}
					positions={positions}
					transactions={transactions}
				/>
			</div>
			<div className={BAND_GRID}>
				<RecentActivityCard transactions={transactions} />
				<div className={WIDE_SPAN}>
					<BalanceSummaryCard />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the home loader runs. It draws the two bands with the same spans. */
export function PortfolioPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className={TOP_BAND_GRID}>
				<Skeleton className={`h-96 ${OVERVIEW_SPAN}`} />
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
			</div>
			<div className={BAND_GRID}>
				<Skeleton className="h-144" />
				<Skeleton className={`h-144 ${WIDE_SPAN}`} />
			</div>
		</div>
	);
}

/** Error state of the home when a loader query fails. Try again runs the loader again. */
export function PortfolioPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("portfolio.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
