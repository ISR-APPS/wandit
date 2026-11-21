// The home behind login: the period and the export in the header, the target card and three KPI cards,
// the hours, deadlines, and stage cards, the hours chart with the team card, then the active matters table.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The KPIs and the middle cards read the summary of that period.
import {
	ClockCountdownIcon,
	DownloadSimpleIcon,
	FolderOpenIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { matterCsvColumns, mattersQueryOptions } from "~/features/matters";
import {
	dayCountFormat,
	downloadCsv,
	fillMessage,
	isOpenStage,
	moneyFormat,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DASHBOARD_DEFAULT_DAYS,
	dashboardQueryOptions,
} from "../api/dashboard.queries";
import { ActiveMattersCard } from "./active-matters-card";
import { AreaHoursCard } from "./area-hours-card";
import { DeadlinesCard } from "./deadlines-card";
import { HoursOverviewCard } from "./hours-overview-card";
import { KpiCard } from "./kpi-card";
import { StagePipelineCard } from "./stage-pipeline-card";
import { TargetCard } from "./target-card";
import { TeamCard } from "./team-card";

/** Five bands: KPIs, 3 summary cards, the hours chart with the team card, then the table. One column on a phone. */
export function DashboardPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DASHBOARD_DEFAULT_DAYS);
	const { data: matters } = useSuspenseQuery(mattersQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...dashboardQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const period = dayCountFormat(locale).format(days);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const activeMatters = matters.filter((matter) => isOpenStage(matter.stage));

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("dashboard.title")}
				description={fillMessage(t("period.description"), {
					period,
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
									"active-matters.csv",
									toCsv(activeMatters, matterCsvColumns(t)),
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
						<TargetCard
							hours={summary.data.billable.hours}
							target={summary.data.billable.target}
							period={period}
						/>
						<KpiCard
							label={t("dashboard.openMatters")}
							value={number.format(summary.data.openMatters.value)}
							change={summary.data.openMatters.change}
							goodWhen="up"
							context={fillMessage(t("dashboard.openedInPeriod"), {
								count: number.format(summary.data.openMatters.opened),
							})}
							icon={FolderOpenIcon}
						/>
						<KpiCard
							label={t("dashboard.unbilled")}
							value={money.format(summary.data.unbilled.value)}
							change={summary.data.unbilled.change}
							// Less unbilled time means the firm bills its work on time.
							goodWhen="down"
							context={fillMessage(t("dashboard.acrossMatters"), {
								count: number.format(summary.data.unbilled.matterCount),
							})}
							icon={ClockCountdownIcon}
						/>
						<KpiCard
							label={t("dashboard.overdue")}
							value={money.format(summary.data.overdue.value)}
							change={summary.data.overdue.change}
							goodWhen="down"
							context={fillMessage(t("dashboard.onInvoices"), {
								count: number.format(summary.data.overdue.count),
							})}
							icon={WarningIcon}
						/>
					</div>
					{/* Two columns on a mid width: the donut beside the deadlines, and the stages under both. */}
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
						<AreaHoursCard areas={summary.data.areas} />
						<DeadlinesCard now={now} />
						<StagePipelineCard stages={summary.data.stages} />
					</div>
					<div className="grid @4xl/main:grid-cols-3 gap-4">
						<HoursOverviewCard />
						<TeamCard team={summary.data.team} />
					</div>
				</>
			)}
			<ActiveMattersCard matters={activeMatters} />
		</div>
	);
}

// Placeholder keys of the KPI row. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_CARDS = ["1", "2", "3"];

// The KPI row and the middle grids while the summary loads.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-40" />
				))}
			</div>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-104" />
				))}
			</div>
			<Skeleton className="h-96" />
		</>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function DashboardPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
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
