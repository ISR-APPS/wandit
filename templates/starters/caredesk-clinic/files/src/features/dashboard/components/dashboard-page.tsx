// The home behind login: the period and the download in the header, then the Overview and Reports tabs.
// Overview: the KPI strip, the visits chart and the departments pie, the calendar, queue, and visit types cards,
// then the upcoming table and the recent patients. Reports: the payment line of each visit of the period.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { appointmentsQueryOptions } from "~/features/appointments";
import {
	downloadCsv,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	toCsv,
	useNow,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	DASHBOARD_DEFAULT_DAYS,
	dashboardQueryOptions,
} from "../api/dashboard.queries";
import { DepartmentsCard } from "./departments-card";
import { FirstVisitsCalendarCard } from "./first-visits-calendar-card";
import { KpiStrip } from "./kpi-strip";
import { QueueCard } from "./queue-card";
import { RecentPatientsCard } from "./recent-patients-card";
import { ReportsTable } from "./reports-table";
import { UpcomingCard } from "./upcoming-card";
import { VisitTypesCard } from "./visit-types-card";
import { VisitsCard } from "./visits-card";

/** The page holds the period. Every figure of both tabs reads the summary of that period. */
export function DashboardPage() {
	const { t, locale } = useT();
	const now = useNow();
	const [days, setDays] = useState<PeriodDays>(DASHBOARD_DEFAULT_DAYS);
	const { data: rows } = useSuspenseQuery(appointmentsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...dashboardQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

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
							aria-label={t("dashboard.download")}
							disabled={summary.data === undefined}
							onClick={() =>
								summary.data &&
								downloadCsv(
									`visits-last-${days}-days.csv`,
									toCsv(summary.data.invoices, [
										{
											header: t("reports.date"),
											value: (row) => date.format(row.at),
										},
										{
											header: t("reports.patient"),
											value: (row) => row.patientName,
										},
										{
											header: t("reports.department"),
											value: (row) => t(`specialties.${row.specialty}`),
										},
										{
											header: t("reports.visit"),
											value: (row) => t(`visitTypes.${row.visitType}`),
										},
										{
											header: t("reports.amount"),
											value: (row) => String(row.amount),
										},
										{
											header: t("reports.status"),
											value: (row) => t(`paymentStatuses.${row.status}`),
										},
									]),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">
								{t("dashboard.download")}
							</span>
						</Button>
					</>
				}
			/>
			<Tabs defaultValue="overview" className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">{t("dashboard.overview")}</TabsTrigger>
					<TabsTrigger value="reports">{t("dashboard.reports")}</TabsTrigger>
				</TabsList>
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
						<TabsContent value="overview" className="grid gap-4">
							<KpiStrip summary={summary.data} days={days} />
							<div className="grid @4xl/main:grid-cols-7 gap-4">
								<VisitsCard days={days} />
								<DepartmentsCard slices={summary.data.departments} />
							</div>
							<div className="grid @4xl/main:grid-cols-3 gap-4">
								<FirstVisitsCalendarCard rows={rows} now={now} />
								<QueueCard rows={rows} now={now} />
								<VisitTypesCard
									visitTypes={summary.data.visitTypes}
									total={summary.data.visits.total}
									previousTotal={summary.data.visits.previousTotal}
								/>
							</div>
							<div className="grid @4xl/main:grid-cols-7 gap-4">
								<UpcomingCard rows={rows} now={now} />
								<RecentPatientsCard rows={rows} />
							</div>
						</TabsContent>
						<TabsContent value="reports">
							<ReportsTable invoices={summary.data.invoices} />
						</TabsContent>
					</>
				)}
			</Tabs>
		</div>
	);
}

// Placeholder keys of the bands. Fixed keys, because the bands never reorder.
const SKELETON_CARDS = ["1", "2", "3"];

// The KPI strip and the first two bands while the summary loads.
function SummarySkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-36" />
			<div className="grid @4xl/main:grid-cols-7 gap-4">
				<Skeleton className="@4xl/main:col-span-4 h-112" />
				<Skeleton className="@4xl/main:col-span-3 h-112" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-120" />
				))}
			</div>
		</div>
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
			<Skeleton className="h-9 w-48" />
			<SummarySkeleton />
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
