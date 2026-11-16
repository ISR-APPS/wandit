// The home behind login: the impressions trend beside four figures, then the channel ranking beside the latest posts.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the home "split" of the app-dashboard skill. The period control drives the trend, the figures, and the ranking.
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNELS,
	DEFAULT_DAYS,
	dayCountFormat,
	fillMessage,
	LoadError,
	type PeriodDays,
	PeriodTabs,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";
import { ChannelRankingCard } from "./channel-ranking-card";
import { ImpressionsTrend } from "./impressions-trend";
import { KpiFigures, KpiFiguresSkeleton } from "./kpi-figures";
import { LatestPostsCard } from "./latest-posts-card";

/** One grid with four children: the trend, the figure block, the ranking, and the latest posts. */
const HOME_GRID =
	"grid grid-cols-1 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-2";

/** The page names the period one time, in its header. No figure repeats it. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					channels: new Intl.NumberFormat(locale).format(CHANNELS.length),
					period: dayCountFormat(locale).format(days),
				})}
				actions={<PeriodTabs days={days} onDaysChange={setDays} />}
			/>
			<div className={HOME_GRID}>
				<ImpressionsTrend days={days} />
				<KpiFigures days={days} />
				<ChannelRankingCard days={days} />
				<LatestPostsCard />
			</div>
		</div>
	);
}

/** Placeholder while the home loader runs. The route sets it as pendingComponent. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64" />
			</div>
			<div className={HOME_GRID}>
				<Skeleton className="h-96" />
				<KpiFiguresSkeleton />
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
			</div>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	return <LoadError message={t("overview.loadError")} />;
}
