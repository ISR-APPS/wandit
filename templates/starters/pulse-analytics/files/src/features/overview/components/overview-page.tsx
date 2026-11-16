// The home behind login: the daily active people beside four figures, then the feature ranking beside the newest accounts.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the home "split" of the app-dashboard skill. The period control drives the trend, the figures, and the ranking.
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DEFAULT_DAYS,
	dayCountFormat,
	fillMessage,
	type PeriodDays,
	PeriodTabs,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { ActivePeopleTrend } from "./active-people-trend";
import { FeatureAdoptionCard } from "./feature-adoption-card";
import { KpiFigures, KpiFiguresSkeleton } from "./kpi-figures";
import { NewestAccountsCard } from "./newest-accounts-card";

/** One grid with four children: the trend, the figure block, the ranked features, and the newest accounts. */
const HOME_GRID =
	"grid grid-cols-1 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-2";

/** The page names the period one time, in its header. No figure repeats it. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const period = dayCountFormat(locale).format(days);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), { period })}
				actions={<PeriodTabs days={days} onDaysChange={setDays} />}
			/>
			<div className={HOME_GRID}>
				<ActivePeopleTrend days={days} />
				<KpiFigures days={days} />
				<FeatureAdoptionCard days={days} />
				<NewestAccountsCard />
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
					<Skeleton className="h-4 w-72 max-w-full" />
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
