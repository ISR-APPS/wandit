// The home behind login: the period and the export in the header, four KPI cards,
// the flow, channel, and workload cards, then the table of the urgent and unassigned tickets.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The KPIs and the three middle cards read the summary of that period.
import {
	ChatCircleTextIcon,
	DownloadSimpleIcon,
	SmileyIcon,
	TimerIcon,
	TrayIcon,
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
	dayCountFormat,
	downloadCsv,
	fillMessage,
	isOpenStatus,
	type PeriodDays,
	toCsv,
} from "~/features/helpdesk";
import { ticketCsvColumns, ticketsQueryOptions } from "~/features/tickets";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DASHBOARD_DEFAULT_DAYS,
	dashboardQueryOptions,
} from "../api/dashboard.queries";
import { ChannelCard } from "./channel-card";
import { FlowCard } from "./flow-card";
import { KpiCard, KpiDelta } from "./kpi-card";
import { PeriodSelect } from "./period-select";
import { UrgentTableCard } from "./urgent-table-card";
import { WorkloadCard } from "./workload-card";

/** Four bands: KPIs, the 3 summary cards, then the full-width table. One column on a phone. */
export function DashboardPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DASHBOARD_DEFAULT_DAYS);
	const { data: tickets } = useSuspenseQuery(ticketsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...dashboardQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const dayCount = dayCountFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	// A KPI value fits one line: "42 min", or "2.3 hr" in place of "2 hr 16 min".
	const unitFormat = (unit: "minute" | "hour") =>
		new Intl.NumberFormat(locale, {
			style: "unit",
			unit,
			unitDisplay: "short",
			maximumFractionDigits: unit === "hour" ? 1 : 0,
		});
	const durationText = (minutes: number | null) =>
		minutes === null
			? "–"
			: minutes < 60
				? unitFormat("minute").format(minutes)
				: // Minutes to hours.
					unitFormat("hour").format(minutes / 60);
	// The table holds the open tickets that need a person now: urgent ones, and the ones with no agent.
	const urgent = tickets
		.filter(
			(ticket) =>
				isOpenStatus(ticket.status) &&
				(ticket.priority === "urgent" || ticket.assignee === null),
		)
		.sort(
			(first, second) =>
				(first.dueAt === null
					? Number.POSITIVE_INFINITY
					: Date.parse(first.dueAt)) -
				(second.dueAt === null
					? Number.POSITIVE_INFINITY
					: Date.parse(second.dueAt)),
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
									"urgent-tickets.csv",
									toCsv(urgent, ticketCsvColumns(t)),
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
							label={t("dashboard.openTickets")}
							value={number.format(summary.data.openTickets.value)}
							icon={TrayIcon}
						>
							<p className="text-muted-foreground text-sm">
								<span
									className={
										summary.data.openTickets.late > 0
											? "font-medium text-destructive"
											: undefined
									}
								>
									{fillMessage(t("dashboard.lateCount"), {
										count: number.format(summary.data.openTickets.late),
									})}
								</span>
								{` · ${fillMessage(t("dashboard.unassignedCount"), {
									count: number.format(summary.data.openTickets.unassigned),
								})}`}
							</p>
						</KpiCard>
						<KpiCard
							label={t("dashboard.firstReply")}
							value={durationText(summary.data.firstReply.value)}
							icon={ChatCircleTextIcon}
						>
							<KpiDelta
								change={summary.data.firstReply.change}
								goodWhen="down"
								context={fillMessage(t("dashboard.overReplies"), {
									count: number.format(summary.data.firstReply.count),
								})}
							/>
						</KpiCard>
						<KpiCard
							label={t("dashboard.resolution")}
							value={durationText(summary.data.resolution.value)}
							icon={TimerIcon}
						>
							<KpiDelta
								change={summary.data.resolution.change}
								goodWhen="down"
								context={fillMessage(t("dashboard.overSolves"), {
									count: number.format(summary.data.resolution.count),
								})}
							/>
						</KpiCard>
						<KpiCard
							label={t("dashboard.satisfaction")}
							value={
								summary.data.satisfaction.value === null
									? "–"
									: percent.format(summary.data.satisfaction.value)
							}
							icon={SmileyIcon}
						>
							<KpiDelta
								change={summary.data.satisfaction.change}
								goodWhen="up"
								context={fillMessage(t("dashboard.fromRatings"), {
									count: number.format(summary.data.satisfaction.count),
								})}
							/>
						</KpiCard>
					</div>
					{/* Two columns on a mid width: the chart beside the donut, and the workload under both. */}
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
						<FlowCard points={summary.data.flow} />
						<ChannelCard channels={summary.data.channels} />
						<WorkloadCard
							workload={summary.data.workload}
							openTotal={summary.data.openTickets.value}
						/>
					</div>
				</>
			)}
			<UrgentTableCard tickets={urgent} now={now} />
		</div>
	);
}

// Placeholder keys of the KPI row and the middle grid. Fixed keys, because the cards never reorder.
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
