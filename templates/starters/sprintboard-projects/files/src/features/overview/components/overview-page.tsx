// The home of the app: the overview of the product team, in three tabs (Overview, Tasks, Bugs).
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the home "tabbed" of the app-dashboard skill, with the kpi form "delta" and the chart form "compare".
import { BugIcon, CheckSquareOffsetIcon } from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { projectsQueryOptions } from "~/features/projects";
import {
	DEFAULT_DAYS,
	dayCountFormat,
	fillMessage,
	membersQueryOptions,
	type PeriodDays,
	PeriodTabs,
	type Task,
	TaskDialog,
	tasksQueryOptions,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { overviewQueryOptions } from "../api/overview.queries";
import type { KpiId, KpiItem } from "../lib/overview-data";
import { overviewTabSchema } from "../lib/overview-search";
import { CompletedByProjectCard } from "./completed-by-project-card";
import { DeliveryFiguresCard } from "./delivery-figures-card";
import { EntityRow } from "./entity-row";
import { EntityTrendCard } from "./entity-trend-card";
import { TaskListCard } from "./task-list-card";

const routeApi = getRouteApi("/app/");

// The entity tabs list the newest rows of their entity, 8 at most.
const LIST_ROWS = 8;

/** The tab lives in the URL (?tab=). The period is one state for every tab. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { tab } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const [openTask, setOpenTask] = useState<Task | null>(null);
	const { data: tasks } = useSuspenseQuery(tasksQueryOptions());
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const { data: members } = useSuspenseQuery(membersQueryOptions());
	// The period changes after a click, so the overview reads with useQuery and keeps the last numbers while it loads.
	const overview = useQuery({
		...overviewQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	const number = new Intl.NumberFormat(locale);
	const activeIds = new Set(
		projects
			.filter((project) => project.status === "active")
			.map((project) => project.id),
	);
	// The tab counts take only active projects, like the header of the Projects page, so both pages agree.
	const openTasks = tasks.filter(
		(task) => task.status !== "done" && activeIds.has(task.projectId),
	);
	const openBugs = openTasks.filter((task) => task.kind === "bug");
	const periodLabel = fillMessage(t("overview.periodLabel"), {
		period: dayCountFormat(locale).format(days),
	});
	const withLabel = (item: KpiItem) => ({
		...item,
		label: t(`kpi.${item.id}`),
	});
	const kpi = (id: KpiId) => overview.data?.kpis.find((item) => item.id === id);
	const completed = kpi("completed");
	const bugsReported = kpi("bugsReported");
	const figures = (
		["pointsShipped", "cycleTime", "onTime", "bugsFixed"] as const
	).flatMap((id) => {
		const item = kpi(id);
		return item ? [{ ...withLabel(item), hint: t(`kpiHint.${id}`) }] : [];
	});
	const tabs = [
		{ id: "overview", label: t("overview.tabOverview"), count: null },
		{ id: "tasks", label: t("overview.tabTasks"), count: openTasks.length },
		{ id: "bugs", label: t("overview.tabBugs"), count: openBugs.length },
	] as const;

	return (
		<Tabs
			value={tab}
			onValueChange={(value) =>
				navigate({
					search: { tab: overviewTabSchema.catch("overview").parse(value) },
					replace: true,
				})
			}
			className="gap-6"
		>
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					projects: number.format(activeIds.size),
					people: number.format(members.length),
				})}
				actions={
					// At 375 px the strip scrolls sideways and never wraps.
					<div className="max-w-full overflow-x-auto">
						<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
							{tabs.map((entry) => (
								<TabsTrigger key={entry.id} value={entry.id} className="px-3">
									{entry.label}
									{entry.count === null ? null : (
										<span className="text-muted-foreground tabular-nums">
											{number.format(entry.count)}
										</span>
									)}
								</TabsTrigger>
							))}
						</TabsList>
					</div>
				}
			/>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-sm">
					{fillMessage(t("overview.periodNote"), {
						period: dayCountFormat(locale).format(days),
					})}
				</p>
				<PeriodTabs days={days} onDaysChange={setDays} />
			</div>

			{overview.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border border-dashed p-6">
					<p role="alert" className="text-sm">
						{t("overview.periodError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => overview.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : overview.data === undefined || !completed || !bugsReported ? (
				<OverviewTabSkeleton />
			) : (
				// The numbers of the last period stay, a little faded, while a new period loads.
				<div
					className={cn(
						"transition-opacity",
						overview.isPlaceholderData && "opacity-60",
					)}
				>
					<TabsContent value="overview" className="grid @3xl/main:gap-6 gap-4">
						<div className="grid gap-3">
							<EntityRow
								tab="tasks"
								name={t("overview.tabTasks")}
								icon={CheckSquareOffsetIcon}
								item={withLabel(completed)}
								points={overview.data.completedDaily}
							/>
							<EntityRow
								tab="bugs"
								name={t("overview.tabBugs")}
								icon={BugIcon}
								item={withLabel(bugsReported)}
								points={overview.data.bugsDaily}
							/>
						</div>
						<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
							<CompletedByProjectCard
								slices={overview.data.completedByProject}
								periodLabel={periodLabel}
							/>
							<DeliveryFiguresCard items={figures} periodLabel={periodLabel} />
						</div>
					</TabsContent>
					<TabsContent
						value="tasks"
						className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4"
					>
						<EntityTrendCard
							title={t("overview.completedTrend")}
							points={overview.data.completedDaily}
						/>
						<TaskListCard
							title={t("overview.newestTasks")}
							description={t("overview.newestTasksNote")}
							tasks={tasks.slice(0, LIST_ROWS)}
							emptyText={t("overview.noTasks")}
							onOpenTask={setOpenTask}
						/>
					</TabsContent>
					<TabsContent
						value="bugs"
						className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4"
					>
						<EntityTrendCard
							title={t("overview.bugsTrend")}
							points={overview.data.bugsDaily}
						/>
						<TaskListCard
							title={t("overview.openBugs")}
							description={fillMessage(t("overview.openBugsNote"), {
								count: number.format(openBugs.length),
							})}
							tasks={openBugs.slice(0, LIST_ROWS)}
							emptyText={t("overview.noBugs")}
							onOpenTask={setOpenTask}
						/>
					</TabsContent>
				</div>
			)}
			<TaskDialog task={openTask} onOpenChange={() => setOpenTask(null)} />
		</Tabs>
	);
}

// Placeholder entity rows. Fixed keys, because they never reorder.
const SKELETON_ROWS = ["tasks", "bugs"];

/** The overview tab in its final shape: two entity rows and the bottom row. */
function OverviewTabSkeleton() {
	return (
		<div className="grid @3xl/main:gap-6 gap-4">
			<div className="grid gap-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-32 rounded-surface" />
				))}
			</div>
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Skeleton className="h-80 rounded-surface" />
				<Skeleton className="h-80 rounded-surface" />
			</div>
		</div>
	);
}

/** Placeholder while the loader runs: the header with the tabs, the period row, and the overview tab. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-36" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Skeleton className="h-4 w-72 max-w-full" />
				<Skeleton className="h-9 w-40" />
			</div>
			<OverviewTabSkeleton />
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
