// The home behind login: the period and the export in the header, four KPI cards, the check-ins chart and the plan mix,
// a row of today's classes, members at risk, and sign-ups, then the member table.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The KPIs, the chart, and the sign-ups read the summary of that period.
import {
	CalendarCheckIcon,
	CurrencyDollarIcon,
	DownloadSimpleIcon,
	GaugeIcon,
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
import { classSessionsQueryOptions } from "~/features/classes";
import {
	addDays,
	DAY_MS,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	moneyFormat,
	type PeriodDays,
	PeriodSelect,
	startOfLocalDay,
	toCsv,
	useNow,
} from "~/features/gym";
import { memberCsvColumns, membersQueryOptions } from "~/features/members";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DASHBOARD_DEFAULT_DAYS,
	dashboardQueryOptions,
} from "../api/dashboard.queries";
import { AtRiskCard } from "./at-risk-card";
import { CheckInsCard } from "./check-ins-card";
import { KpiCard } from "./kpi-card";
import { MembersTableCard } from "./members-table-card";
import { PlanMixCard } from "./plan-mix-card";
import { SignUpsCard } from "./sign-ups-card";
import { TodaysClassesCard } from "./todays-classes-card";

/** Four bands: KPIs, the chart and the donut, a row of 3 cards, then the full-width table. One column on a phone. */
export function DashboardPage() {
	const { t, locale } = useT();
	const now = useNow();
	const [days, setDays] = useState<PeriodDays>(DASHBOARD_DEFAULT_DAYS);
	const { data: members } = useSuspenseQuery(membersQueryOptions());
	const { data: sessions } = useSuspenseQuery(classSessionsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...dashboardQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const todayStart = startOfLocalDay(now);
	const todaysSessions = sessions.filter(
		(row) =>
			row.startsAt >= todayStart && row.startsAt < addDays(todayStart, 1),
	);
	const atRisk = members
		.filter((row) => row.isAtRisk)
		.sort(
			(first, second) => (first.lastVisitAt ?? 0) - (second.lastVisitAt ?? 0),
		);
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
								downloadCsv("members.csv", toCsv(members, memberCsvColumns(t)))
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
							label={t("dashboard.activeMembers")}
							value={number.format(summary.data.kpis.activeMembers.value)}
							change={summary.data.kpis.activeMembers.change}
							goodWhen="up"
							context={fillMessage(t("dashboard.since"), {
								date: shortDate.format(now - days * DAY_MS),
							})}
							icon={UsersThreeIcon}
						/>
						<KpiCard
							label={t("dashboard.checkInsToday")}
							value={number.format(summary.data.kpis.checkInsToday.value)}
							change={summary.data.kpis.checkInsToday.change}
							goodWhen="up"
							context={fillMessage(t("dashboard.vsAverage"), {
								period: dayCount.format(days),
							})}
							icon={CalendarCheckIcon}
						/>
						<KpiCard
							label={t("dashboard.fillRate")}
							value={
								summary.data.kpis.fillRate.value === null
									? "–"
									: percent.format(summary.data.kpis.fillRate.value)
							}
							change={summary.data.kpis.fillRate.change}
							goodWhen="up"
							context={fillMessage(t("dashboard.acrossClasses"), {
								count: number.format(summary.data.kpis.fillRate.sessions),
							})}
							icon={GaugeIcon}
						/>
						<KpiCard
							label={t("dashboard.monthlyRevenue")}
							value={money.format(summary.data.kpis.monthlyRevenue.value)}
							change={summary.data.kpis.monthlyRevenue.change}
							goodWhen="up"
							context={fillMessage(t("dashboard.vsBefore"), {
								period: dayCount.format(days),
							})}
							icon={CurrencyDollarIcon}
						/>
					</div>
					<div className="grid @4xl/main:grid-cols-3 gap-4">
						<CheckInsCard
							daily={summary.data.daily}
							hourly={summary.data.hourly}
							days={days}
						/>
						<PlanMixCard planMix={summary.data.planMix} />
					</div>
					{/* Two columns on a mid width: the classes beside the feed, and the sign-ups under both. */}
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
						<TodaysClassesCard sessions={todaysSessions} now={now} />
						<AtRiskCard members={atRisk} now={now} />
						<SignUpsCard signUps={summary.data.signUps} days={days} />
					</div>
				</>
			)}
			<MembersTableCard members={members} />
		</div>
	);
}

// Placeholder keys of the KPI row and the card rows. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_CARDS = ["1", "2", "3"];

// The three bands of the summary while it loads.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-36" />
				))}
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="@4xl/main:col-span-2 h-112" />
				<Skeleton className="h-112" />
			</div>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-96" />
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
