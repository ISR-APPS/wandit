// The home behind login, on the grid of the kit "website analytics" page: the period and the export in the header,
// four stat cards, the engagement report (8/12) and the queue donut (4/12), then six cards in rows of three.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. Every card reads the one overview object of that period.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNELS,
	DEFAULT_DAYS,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	LoadError,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type OverviewData,
	overviewQueryOptions,
} from "../api/overview.queries";
import { ChannelReachCard } from "./channel-reach-card";
import { ConversationCard } from "./conversation-card";
import { EngagementReportCard } from "./engagement-report-card";
import { PeriodSummaryCard } from "./period-summary-card";
import { QueueCard } from "./queue-card";
import {
	DailyImpressionsCard,
	FormatSplitCard,
	ReachSummaryCard,
} from "./small-cards";
import { StatCards } from "./stat-cards";

/** The kit 12-column grid: stats full width, 8 + 4 from the 4xl container width, then rows of three from 3xl. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const overview = useQuery({
		...overviewQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const dayCount = dayCountFormat(locale);

	function exportDays(data: OverviewData) {
		downloadCsv(
			`postbox-overview-${days}-days.csv`,
			toCsv(data.days, [
				{ header: t("overview.csv.day"), value: (row) => row.id },
				{
					header: t("metrics.impressions"),
					value: (row) => String(row.impressions),
				},
				{
					header: t("metrics.engagements"),
					value: (row) => String(row.engagements),
				},
				{
					header: t("metrics.newFollowers"),
					value: (row) => String(row.followerGain),
				},
				{
					header: t("metrics.postsPublished"),
					value: (row) => String(row.posts),
				},
			]),
		);
	}

	const data = overview.data;
	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					channels: String(CHANNELS.length),
					period: dayCount.format(days),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							disabled={!data}
							onClick={() => (data ? exportDays(data) : undefined)}
							aria-label={t("overview.exportCsv")}
						>
							<DownloadSimpleIcon />
							<span className="@4xl/main:inline hidden">
								{t("overview.exportCsv")}
							</span>
						</Button>
					</>
				}
			/>
			{overview.isError && !data ? (
				<LoadError message={t("overview.loadError")} />
			) : !data ? (
				<OverviewGridSkeleton />
			) : (
				<div className="grid @3xl/main:grid-cols-12 gap-4">
					<div className="@3xl/main:col-span-12">
						<StatCards stats={data.stats} />
					</div>
					<div className="@3xl/main:col-span-12 @5xl/main:col-span-8">
						<EngagementReportCard report={data.engagementReport} days={days} />
					</div>
					<div className="@3xl/main:col-span-12 @5xl/main:col-span-4">
						<QueueCard queue={data.queue} />
					</div>
					<div className="@3xl/main:col-span-4">
						<ReachSummaryCard summary={data.reachSummary} />
					</div>
					<div className="@3xl/main:col-span-4">
						<DailyImpressionsCard daily={data.dailyImpressions} />
					</div>
					<div className="@3xl/main:col-span-4">
						<FormatSplitCard split={data.formatSplit} />
					</div>
					<div className="@3xl/main:col-span-4">
						<ChannelReachCard channels={data.channels} days={days} />
					</div>
					<div className="@3xl/main:col-span-4">
						<ConversationCard conversation={data.conversation} />
					</div>
					<div className="@3xl/main:col-span-4">
						<PeriodSummaryCard
							summary={data.summary}
							engagements={
								data.summary.find((figure) => figure.id === "engagements")
									?.value ?? 0
							}
							channelCount={CHANNELS.length}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

// The grid of the page while the first period loads: the same bands as the loaded page.
function OverviewGridSkeleton() {
	return (
		<div className="grid @3xl/main:grid-cols-12 gap-4">
			<div className="@3xl/main:col-span-12 grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{["a", "b", "c", "d"].map((key) => (
					<Skeleton key={key} className="h-24" />
				))}
			</div>
			<Skeleton className="@3xl/main:col-span-12 @5xl/main:col-span-8 h-96" />
			<Skeleton className="@3xl/main:col-span-12 @5xl/main:col-span-4 h-96" />
			{["e", "f", "g", "h", "i", "j"].map((key) => (
				<Skeleton key={key} className="@3xl/main:col-span-4 h-56" />
			))}
		</div>
	);
}

/** Loading state of the home: the header row and the grid of the page. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-56" />
			</div>
			<OverviewGridSkeleton />
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	return <LoadError message={t("overview.loadError")} />;
}
