// The home behind login: a bento mosaic of the marketing results of the last 30 days.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the home "bento" of the app-dashboard skill: a figure, a breakdown, and the status counts open the page.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	moneyFormat,
	type PeriodDays,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewKpisQueryOptions } from "../api/overview.queries";
import { ActivityCard } from "./activity-card";
import { CampaignStatusCard } from "./campaign-status-card";
import { ConversionsTrendCard } from "./conversions-trend-card";
import { KpiFigureCard, KpiFigureCardSkeleton } from "./kpi-figure-card";
import { SpendByChannelCard } from "./spend-by-channel-card";
import { TopCampaignsCard } from "./top-campaigns-card";

/** The period of the first load of the trend, in days. The loader prefetches it. */
export const DEFAULT_DAYS: PeriodDays = 30;

// 2 columns under 56rem, 12 from 56rem. Row 1 mixes three kinds at three widths.
// From 42rem the large figure and the breakdown share a row, so a tablet does not show one huge tile.
// From 42rem to 56rem the status and ranked tiles share row 2, and the two small figures share a row.
// The order-1 tiles go after them in that range only. Tiles of the same height then share each row.
const BENTO_GRID =
	"grid grid-cols-2 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-12";
const LATER_IN_TWO_COLUMNS = "@2xl/main:@max-4xl/main:order-1";
const TILE_SPANS = {
	figureLarge: "col-span-2 @2xl/main:col-span-1 @4xl/main:col-span-5",
	breakdown: "col-span-2 @2xl/main:col-span-1 @4xl/main:col-span-4",
	status: "col-span-2 @2xl/main:col-span-1 @4xl/main:col-span-3",
	trend: `col-span-2 @4xl/main:col-span-8 @4xl/main:row-span-2 ${LATER_IN_TWO_COLUMNS}`,
	figureSmall: `@4xl/main:col-span-2 ${LATER_IN_TWO_COLUMNS}`,
	ranked: "col-span-2 @2xl/main:col-span-1 @4xl/main:col-span-4",
	activity: `col-span-2 @4xl/main:col-span-12 ${LATER_IN_TWO_COLUMNS}`,
} as const;

/** The tiles keep the DOM order of the bento spec, so the grid places the small figures beside the trend. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const money = moneyFormat(locale, "compact");
	const [conversions, ...smallFigures] = kpis.items;

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("overview.title")}
				description={t("overview.description")}
			/>
			<div className={BENTO_GRID}>
				{conversions ? (
					<KpiFigureCard
						kpi={conversions}
						size="large"
						hint={fillMessage(t("overview.conversionsHint"), {
							spend: money.format(kpis.spend),
							revenue: money.format(kpis.revenue),
						})}
						className={TILE_SPANS.figureLarge}
					/>
				) : null}
				<SpendByChannelCard className={TILE_SPANS.breakdown} />
				<CampaignStatusCard className={TILE_SPANS.status} />
				<ConversionsTrendCard
					defaultDays={DEFAULT_DAYS}
					className={TILE_SPANS.trend}
				/>
				{smallFigures.map((kpi) => (
					<KpiFigureCard
						key={kpi.id}
						kpi={kpi}
						size="small"
						className={TILE_SPANS.figureSmall}
					/>
				))}
				<TopCampaignsCard className={TILE_SPANS.ranked} />
				<ActivityCard className={TILE_SPANS.activity} />
			</div>
		</div>
	);
}

/** Placeholder while the home loader runs: the same mosaic with the same spans. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80" />
			</div>
			<div className={BENTO_GRID}>
				<KpiFigureCardSkeleton
					size="large"
					className={TILE_SPANS.figureLarge}
				/>
				<Card className={`h-64 ${TILE_SPANS.breakdown}`} />
				<Card className={`h-64 ${TILE_SPANS.status}`} />
				<Card className={`h-96 ${TILE_SPANS.trend}`} />
				<KpiFigureCardSkeleton
					size="small"
					className={TILE_SPANS.figureSmall}
				/>
				<KpiFigureCardSkeleton
					size="small"
					className={TILE_SPANS.figureSmall}
				/>
				<Card className={`h-56 ${TILE_SPANS.ranked}`} />
				<Card className={`h-48 ${TILE_SPANS.activity}`} />
			</div>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
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
