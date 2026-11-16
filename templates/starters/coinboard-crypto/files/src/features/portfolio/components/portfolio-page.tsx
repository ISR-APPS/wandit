// The home of the app: a mosaic of the portfolio value, the allocation, the market mood, the value trend,
// two small figures, the largest holdings, and the newest activity. The /app route renders it after its loader.
// The route also uses the skeleton and the error below. It follows the home "bento" of the app-dashboard skill.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { transactionsQueryOptions } from "~/features/activity";
import { PageHeader } from "~/features/app-shell";
import { positionsQueryOptions } from "~/features/holdings";
import { DEFAULT_DAYS, fillMessage, type PeriodDays } from "~/features/ledger";
import { assetsQueryOptions } from "~/features/markets";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { portfolioSummaryQueryOptions } from "../api/portfolio.queries";
import { buildAllocation } from "../lib/portfolio-value";
import { AllocationTile } from "./allocation-tile";
import { LatestActivityTile } from "./latest-activity-tile";
import { MarketBreadthTile } from "./market-breadth-tile";
import { PortfolioValueTile } from "./portfolio-value-tile";
import { SmallFigure } from "./small-figure";
import { TopHoldingsTile } from "./top-holdings-tile";
import { ValueTrendTile } from "./value-trend-tile";

// 2 columns under 56rem, 12 from 56rem. Row 1 mixes three kinds at three widths.
// From 42rem the breakdown and the status sit side by side, so a tablet does not stack every tile.
const BENTO_GRID =
	"grid grid-cols-2 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-12";
const TILE_SPANS = {
	figureLarge: "col-span-2 @4xl/main:col-span-5",
	breakdown: "col-span-2 @2xl/main:col-span-1 @4xl/main:col-span-4",
	status: "col-span-2 @2xl/main:col-span-1 @4xl/main:col-span-3",
	trend: "col-span-2 @4xl/main:col-span-8 @4xl/main:row-span-2",
	figureSmall: "@4xl/main:col-span-2",
	ranked: "col-span-2 @4xl/main:col-span-4",
	activity: "col-span-2 @4xl/main:col-span-12",
} as const;

/** The home page. Only the trend tile changes with the period control. The large figure always shows 7 days. */
export function PortfolioPage() {
	const { t, locale } = useT();
	const { data: summary } = useSuspenseQuery(portfolioSummaryQueryOptions());
	const { data: positions } = useSuspenseQuery(positionsQueryOptions());
	const { data: assets } = useSuspenseQuery(assetsQueryOptions());
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const number = new Intl.NumberFormat(locale);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("portfolio.title")}
				description={fillMessage(t("portfolio.description"), {
					assets: number.format(summary.assetCount),
					accounts: number.format(summary.accountCount),
				})}
			/>
			<div className={BENTO_GRID}>
				<PortfolioValueTile
					summary={summary}
					className={TILE_SPANS.figureLarge}
				/>
				<AllocationTile
					parts={buildAllocation(positions)}
					className={TILE_SPANS.breakdown}
				/>
				<MarketBreadthTile assets={assets} className={TILE_SPANS.status} />
				<ValueTrendTile
					days={days}
					onDaysChange={setDays}
					className={TILE_SPANS.trend}
				/>
				<SmallFigure
					label={t("portfolio.dayChangeLabel")}
					amount={summary.dayChange}
					change={summary.dayChangeRatio}
					comparison={t("portfolio.dayChangeComparison")}
					className={TILE_SPANS.figureSmall}
				/>
				<SmallFigure
					label={t("portfolio.profitLabel")}
					amount={summary.profit}
					change={summary.profitRatio}
					comparison={t("portfolio.profitComparison")}
					className={TILE_SPANS.figureSmall}
				/>
				<TopHoldingsTile positions={positions} className={TILE_SPANS.ranked} />
				<LatestActivityTile
					transactions={transactions}
					className={TILE_SPANS.activity}
				/>
			</div>
		</div>
	);
}

/** Placeholder while the home loader runs. It draws the mosaic with the same spans. */
export function PortfolioPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className={BENTO_GRID}>
				<Skeleton className={`h-64 ${TILE_SPANS.figureLarge}`} />
				<Skeleton className={`h-64 ${TILE_SPANS.breakdown}`} />
				<Skeleton className={`h-64 ${TILE_SPANS.status}`} />
				<Skeleton className={`@4xl/main:h-auto h-96 ${TILE_SPANS.trend}`} />
				<Skeleton className={`h-28 ${TILE_SPANS.figureSmall}`} />
				<Skeleton className={`h-28 ${TILE_SPANS.figureSmall}`} />
				<Skeleton className={`h-80 ${TILE_SPANS.ranked}`} />
				<Skeleton className={`h-80 ${TILE_SPANS.activity}`} />
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
