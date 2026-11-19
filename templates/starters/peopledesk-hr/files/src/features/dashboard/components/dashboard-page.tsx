// The home behind login: the period and the export in the header, four KPI cards, the joiners, funnel,
// and team cards, then the leave calendar beside the table of upcoming time off.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The KPIs, the funnel, and the team card read the summary of that period.
import {
	AirplaneTiltIcon,
	BriefcaseIcon,
	DownloadSimpleIcon,
	HourglassMediumIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { employeesQueryOptions } from "~/features/employees";
import {
	dayCountFormat,
	downloadCsv,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	shiftDays,
	startOfLocalDay,
	toCsv,
	toDayKey,
} from "~/features/people";
import {
	requestCsvColumns,
	timeOffRequestsQueryOptions,
} from "~/features/time-off";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DASHBOARD_DEFAULT_DAYS,
	dashboardQueryOptions,
} from "../api/dashboard.queries";
import { HiringFunnelCard } from "./hiring-funnel-card";
import { JoinersCard } from "./joiners-card";
import { KpiCard } from "./kpi-card";
import { TeamHeadcountCard } from "./team-headcount-card";
import { TimeOffCalendarCard } from "./time-off-calendar-card";
import { UpcomingTimeOffCard } from "./upcoming-time-off-card";

/** Four bands: KPIs, the 3 summary cards, then the calendar and the table. One column on a phone. */
export function DashboardPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DASHBOARD_DEFAULT_DAYS);
	const { data: employees } = useSuspenseQuery(employeesQueryOptions());
	const { data: requests } = useSuspenseQuery(timeOffRequestsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...dashboardQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const todayStart = startOfLocalDay(now);
	const today = toDayKey(new Date(todayStart));
	const number = new Intl.NumberFormat(locale);
	const dayCount = dayCountFormat(locale);
	const longDay = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	// The first day of the period: the KPI deltas compare with it.
	const periodStart = shortDate.format(shiftDays(todayStart, 1 - days));
	const upcoming = requests
		.filter(
			(request) =>
				(request.status === "approved" || request.status === "pending") &&
				request.endDate >= today,
		)
		.sort((first, second) => first.startDate.localeCompare(second.startDate));

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("dashboard.title")}
				description={fillMessage(t("period.description"), {
					period: dayCount.format(days),
					today: longDay.format(now),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv(
									"upcoming-time-off.csv",
									toCsv(upcoming, requestCsvColumns(t, locale)),
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
							label={t("dashboard.headcount")}
							value={number.format(summary.data.headcount.value)}
							change={summary.data.headcount.change}
							goodWhen="up"
							context={fillMessage(t("dashboard.since"), {
								date: periodStart,
							})}
							icon={UsersThreeIcon}
						/>
						<KpiCard
							label={t("dashboard.openRoles")}
							value={number.format(summary.data.openRoles.value)}
							change={summary.data.openRoles.change}
							goodWhen="up"
							context={fillMessage(t("dashboard.candidatesInRace"), {
								count: number.format(summary.data.openRoles.candidates),
							})}
							icon={BriefcaseIcon}
						/>
						<KpiCard
							label={t(
								summary.data.outToday.isNextWorkday
									? "dashboard.outMonday"
									: "dashboard.outToday",
							)}
							value={number.format(summary.data.outToday.value)}
							change={summary.data.outToday.change}
							goodWhen="down"
							context={fillMessage(t("dashboard.vsAverage"), {
								period: dayCount.format(days),
							})}
							icon={AirplaneTiltIcon}
						/>
						<KpiCard
							label={t("dashboard.timeToHire")}
							value={
								summary.data.timeToHire.value === null
									? "–"
									: dayCount.format(Math.round(summary.data.timeToHire.value))
							}
							change={summary.data.timeToHire.change}
							goodWhen="down"
							context={fillMessage(t("dashboard.acrossHires"), {
								count: number.format(summary.data.timeToHire.hires),
							})}
							icon={HourglassMediumIcon}
						/>
					</div>
					{/* Two columns on a mid width: the joiners beside the funnel, and the team bars under both. */}
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
						<JoinersCard employees={employees} />
						<HiringFunnelCard stages={summary.data.funnel} />
						<TeamHeadcountCard
							teams={summary.data.teams}
							joined={summary.data.headcount.joined}
							left={summary.data.headcount.left}
							period={dayCount.format(days)}
						/>
					</div>
				</>
			)}
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<TimeOffCalendarCard requests={requests} todayStart={todayStart} />
				<UpcomingTimeOffCard requests={upcoming} />
			</div>
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
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-112" />
				<Skeleton className="@4xl/main:col-span-2 h-112" />
			</div>
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
