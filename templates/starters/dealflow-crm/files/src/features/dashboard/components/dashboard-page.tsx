// The home behind login: the period and the export in the header, four KPI cards,
// the sources, follow-ups, and pipeline cards, then the table of the deals that need attention.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The KPIs and the two summary cards read the summary of that period.
import {
	CoinsIcon,
	DownloadSimpleIcon,
	FunnelIcon,
	TargetIcon,
	TrophyIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DAY_MS,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	moneyFormat,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/crm";
import {
	daysInStage,
	dealCsvColumns,
	dealsQueryOptions,
	needsAttention,
} from "~/features/deals";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DASHBOARD_DEFAULT_DAYS,
	dashboardQueryOptions,
} from "../api/dashboard.queries";
import { AttentionTableCard } from "./attention-table-card";
import { FollowUpsCard } from "./follow-ups-card";
import { KpiCard } from "./kpi-card";
import { PipelineStageCard } from "./pipeline-stage-card";
import { SourceCard } from "./source-card";

/** Four bands: KPIs, the 3 summary cards, then the full-width table. One column on a phone. */
export function DashboardPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DASHBOARD_DEFAULT_DAYS);
	const { data: deals } = useSuspenseQuery(dealsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...dashboardQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const dayCount = dayCountFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const attention = deals
		.filter((deal) => needsAttention(deal, now))
		.sort(
			(first, second) => daysInStage(second, now) - daysInStage(first, now),
		);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("dashboard.title")}
				description={fillMessage(t("period.description"), {
					period: dayCount.format(days),
					today: today.format(now),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv(
									"deals-need-attention.csv",
									toCsv(attention, dealCsvColumns(t, now)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			{summary.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border p-6">
					<p className="text-sm" role="alert">
						{t("dashboard.summaryError")}
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
						<KpiCard
							label={t("dashboard.openPipeline")}
							value={money.format(summary.data.openPipeline.value)}
							change={summary.data.openPipeline.change}
							context={fillMessage(t("dashboard.since"), {
								date: shortDate.format(now - days * DAY_MS),
							})}
							icon={FunnelIcon}
						/>
						<KpiCard
							label={t("dashboard.won")}
							value={money.format(summary.data.won.value)}
							change={summary.data.won.change}
							context={fillMessage(t("dashboard.vsBefore"), {
								period: dayCount.format(days),
							})}
							icon={TrophyIcon}
						/>
						<KpiCard
							label={t("dashboard.winRate")}
							value={
								summary.data.winRate.value === null
									? "–"
									: percent.format(summary.data.winRate.value)
							}
							change={summary.data.winRate.change}
							context={fillMessage(t("dashboard.acrossClosed"), {
								count: number.format(summary.data.winRate.closed),
							})}
							icon={TargetIcon}
						/>
						<KpiCard
							label={t("dashboard.averageDeal")}
							value={
								summary.data.averageDeal.value === null
									? "–"
									: money.format(summary.data.averageDeal.value)
							}
							change={summary.data.averageDeal.change}
							context={fillMessage(t("dashboard.acrossWon"), {
								count: number.format(summary.data.won.count),
							})}
							icon={CoinsIcon}
						/>
					</div>
					{/* Two columns on a mid width: the donut beside the follow-ups, and the pipeline under both. */}
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
						<SourceCard sources={summary.data.sources} />
						<FollowUpsCard now={now} />
						<PipelineStageCard stages={summary.data.stages} />
					</div>
				</>
			)}
			<AttentionTableCard deals={attention} />
		</div>
	);
}

// Placeholder keys of the KPI row. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_CARDS = ["1", "2", "3"];

// The KPI row and the middle grid while the summary loads.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-36" />
				))}
			</div>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-104" />
				))}
			</div>
		</>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function DashboardPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<SummarySkeleton />
			<Skeleton className="h-112" />
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function DashboardPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("dashboard.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
