// The home behind login: the title with the period and the export menu, then the tabs Overview and Reports.
// Overview: four KPI cards, the work chart beside the team card, the reminders, the monthly and on-time cards,
// and the recent projects table. Reports: the table of every project. The /app route renders it after its loader.
// The page holds the period. The KPIs, the team card, and the on-time card read the summary of that period.
import {
	BriefcaseIcon,
	CalendarCheckIcon,
	ClockCountdownIcon,
	DownloadSimpleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type Project,
	projectCsvColumns,
	projectsQueryOptions,
} from "~/features/projects";
import { taskCsvColumns } from "~/features/tasks";
import {
	dayCountFormat,
	downloadCsv,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	periodOf,
	tasksQueryOptions,
	toCsv,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { RecordTable } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	OVERVIEW_DEFAULT_DAYS,
	overviewSummaryQueryOptions,
} from "../api/overview.queries";
import type { OverviewSummary } from "../lib/overview-data";
import { overviewTabSchema } from "../lib/overview-search";
import { KpiCard } from "./kpi-card";
import { MonthlyDoneCard } from "./monthly-done-card";
import { OnTimeCard } from "./on-time-card";
import { ProjectRowMenu, projectColumns } from "./project-columns";
import { RemindersCard } from "./reminders-card";
import { TeamHighlightsCard } from "./team-highlights-card";
import { WorkChartCard } from "./work-chart-card";

/** The recent projects card shows this many rows per page, as the kit home table. */
const RECENT_PAGE_SIZE = 6;

/** The tab lives in the URL. One column on a phone; the bands open to their kit spans from the 4xl container. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { tab } = useSearch({ from: "/app/" });
	const navigate = useNavigate({ from: "/app/" });
	const [days, setDays] = useState<PeriodDays>(OVERVIEW_DEFAULT_DAYS);
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const { data: tasks } = useSuspenseQuery(tasksQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...overviewSummaryQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const period = dayCountFormat(locale).format(days);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const recent = [...projects].sort((first, second) =>
		second.startAt.localeCompare(first.startAt),
	);
	const columns = projectColumns(t, locale);

	function exportProjects() {
		downloadCsv("projects.csv", toCsv(projects, projectCsvColumns(t, locale)));
	}

	function exportDoneTasks() {
		const done = tasks.filter(
			(task) =>
				task.completedAt !== null &&
				periodOf(task.completedAt, days, now) === "current",
		);
		downloadCsv(
			`tasks-done-${days}-days.csv`,
			toCsv(done, taskCsvColumns(t, locale)),
		);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					period,
					today: today.format(now),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" aria-label={t("overview.export")}>
									<DownloadSimpleIcon />
									<span className="hidden lg:inline">
										{t("overview.export")}
									</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={exportProjects}>
									{t("overview.exportProjects")}
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={exportDoneTasks}>
									{fillMessage(t("overview.exportDone"), { period })}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					const next = overviewTabSchema.safeParse(value);
					if (next.success) {
						navigate({ search: { tab: next.data }, replace: true });
					}
				}}
				className="gap-4"
			>
				<TabsList>
					<TabsTrigger value="overview">
						{t("overview.tabOverview")}
					</TabsTrigger>
					<TabsTrigger value="reports">{t("overview.tabReports")}</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="grid gap-4">
					{summary.isError ? (
						<div className="grid justify-items-start gap-3 rounded-surface border p-6">
							<p className="text-sm" role="alert">
								{t("overview.summaryError")}
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
						<SummaryBands summary={summary.data} period={period} />
					)}
					<div className="grid @4xl/main:grid-cols-2 @[96rem]/main:grid-cols-4 gap-4">
						<RemindersCard tasks={tasks} now={now} />
						{summary.data === undefined ? null : (
							<>
								<MonthlyDoneCard months={summary.data.months} />
								<OnTimeCard counts={summary.data.delivery} period={period} />
							</>
						)}
					</div>
					<Card>
						<CardHeader>
							<CardTitle>{t("overview.recentTitle")}</CardTitle>
						</CardHeader>
						<CardContent>
							<RecordTable<Project>
								rows={recent}
								columns={[
									columns.name,
									columns.lead,
									columns.start,
									columns.target,
									columns.status,
									columns.progress,
								]}
								searchText={(project) =>
									`${project.name} ${project.key} ${project.leadName}`
								}
								searchPlaceholder={t("overview.filterProjects")}
								rowMenu={(project) => <ProjectRowMenu project={project} />}
								selectable
								pageSize={RECENT_PAGE_SIZE}
								noResults={t("projects.noResults")}
							/>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="reports">
					<RecordTable<Project>
						rows={projects}
						columns={[
							columns.key,
							columns.name,
							columns.lead,
							columns.status,
							columns.start,
							columns.target,
							columns.points,
							columns.progress,
						]}
						searchText={(project) =>
							`${project.name} ${project.key} ${project.leadName}`
						}
						searchPlaceholder={t("overview.searchProjects")}
						pageSize={15}
						noResults={t("projects.noResults")}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}

type SummaryBandsProps = {
	summary: OverviewSummary;
	/** The page period in words, for example "30 days". */
	period: string;
};

// The KPI row and the middle row of the dashboard tab.
function SummaryBands({ summary, period }: SummaryBandsProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const hours = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "hour",
		unitDisplay: "narrow",
		maximumFractionDigits: 0,
	});
	const vsBefore = fillMessage(t("overview.vsBefore"), { period });
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<KpiCard
					label={t("overview.activeProjects")}
					value={number.format(summary.activeProjects.value)}
					change={summary.activeProjects.change}
					goodWhen="up"
					context={fillMessage(t("overview.sinceStart"), { period })}
					icon={BriefcaseIcon}
				/>
				<KpiCard
					label={t("overview.dueThisWeek")}
					value={number.format(summary.dueThisWeek.value)}
					change={summary.dueThisWeek.change}
					goodWhen="down"
					context={t("overview.vsLastWeek")}
					icon={CalendarCheckIcon}
				/>
				<KpiCard
					label={t("overview.hoursLogged")}
					value={hours.format(summary.hoursLogged.value)}
					change={summary.hoursLogged.change}
					goodWhen="up"
					context={vsBefore}
					icon={ClockCountdownIcon}
				/>
				<KpiCard
					label={t("overview.overdueTasks")}
					value={number.format(summary.overdue.value)}
					change={summary.overdue.change}
					goodWhen="down"
					context={fillMessage(t("overview.sinceStart"), { period })}
					icon={WarningCircleIcon}
				/>
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<div className="@4xl/main:col-span-2 min-w-0">
					<WorkChartCard />
				</div>
				<TeamHighlightsCard summary={summary} />
			</div>
		</>
	);
}

// Placeholder keys of the KPI row. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];

// The KPI row and the middle row while the summary loads.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-36" />
				))}
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="@4xl/main:col-span-2 h-96" />
				<Skeleton className="h-96" />
			</div>
		</>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<Skeleton className="h-9 w-48" />
			<SummarySkeleton />
			<Skeleton className="h-96" />
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
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
