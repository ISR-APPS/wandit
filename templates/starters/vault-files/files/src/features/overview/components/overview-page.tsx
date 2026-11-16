// The home behind login (kpi-band): four storage figures, uploads per day by type beside uploads by team,
// then the files that changed last. The /app route renders it after its loader.
// The trend reads with useQuery, so a period change keeps the old bars until the new ones arrive.
import { FolderOpenIcon } from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { filesQueryOptions } from "~/features/files";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	dailyUploadsQueryOptions,
	overviewKpisQueryOptions,
	uploadsByTeamQueryOptions,
} from "../api/overview.queries";
import { DEFAULT_DAYS, type PeriodDays } from "../lib/series";
import { RecentFilesCard, RecentFilesCardSkeleton } from "./recent-files-card";
import { StorageFigures, StorageFiguresSkeleton } from "./storage-figures";
import { TeamUploadsCard, TeamUploadsCardSkeleton } from "./team-uploads-card";
import {
	UploadsTrendCard,
	UploadsTrendCardSkeleton,
} from "./uploads-trend-card";

// The newest rows panel shows six files: one screen of rows on a laptop.
const RECENT_COUNT = 6;

const BAND_CLASS =
	"grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";
const CHARTS_CLASS = "grid grid-cols-1 gap-4 @4xl/main:grid-cols-3";

/** The home. The page holds the trend period; the breakdown keeps DEFAULT_DAYS. */
export function OverviewPage() {
	const { t } = useT();
	const { data: kpis } = useSuspenseQuery(overviewKpisQueryOptions());
	const { data: teamSlices } = useSuspenseQuery(
		uploadsByTeamQueryOptions(DEFAULT_DAYS),
	);
	const { data: filesList } = useSuspenseQuery(filesQueryOptions());
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const trend = useQuery({
		...dailyUploadsQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("overview.title")}
				description={t("overview.description")}
				actions={
					<Button asChild>
						<Link to="/app/files">
							<FolderOpenIcon />
							{t("overview.browseFiles")}
						</Link>
					</Button>
				}
			/>
			<StorageFigures
				className={BAND_CLASS}
				items={kpis.map((kpi) => ({ ...kpi, label: t(kpi.labelKey) }))}
			/>
			<div className={CHARTS_CLASS}>
				<div className="@4xl/main:col-span-2 min-w-0">
					{trend.data ? (
						<UploadsTrendCard
							title={t("overview.trendTitle")}
							description={t("overview.trendDescription")}
							points={trend.data.map((point) => ({
								...point,
								category: t(`fileCategories.${point.category}`),
							}))}
							days={days}
							onDaysChange={setDays}
						/>
					) : trend.isError ? (
						<Card className="h-full">
							<CardContent className="grid h-full content-center justify-items-start gap-3">
								<p role="alert" className="text-sm">
									{t("overview.trendError")}
								</p>
								<Button
									type="button"
									variant="outline"
									onClick={() => void trend.refetch()}
								>
									{t("common.retry")}
								</Button>
							</CardContent>
						</Card>
					) : (
						<UploadsTrendCardSkeleton />
					)}
				</div>
				<TeamUploadsCard
					title={t("overview.teamTitle")}
					slices={teamSlices.map((slice) => ({
						label: t(`teams.${slice.label}`),
						value: slice.value,
					}))}
				/>
			</div>
			<RecentFilesCard files={filesList.files.slice(0, RECENT_COUNT)} />
		</div>
	);
}

/** Placeholder while the home loader runs, with the spans and heights of the page. */
export function OverviewPageSkeleton() {
	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-36" />
			</div>
			<StorageFiguresSkeleton className={BAND_CLASS} />
			<div className={CHARTS_CLASS}>
				<div className="@4xl/main:col-span-2">
					<UploadsTrendCardSkeleton />
				</div>
				<TeamUploadsCardSkeleton />
			</div>
			<RecentFilesCardSkeleton />
		</div>
	);
}

/** Error state of the home when its loader fails. Try again runs the loader again. */
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
