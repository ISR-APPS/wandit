// The project list behind login: the page header, the status tabs, and the searchable table of projects.
// The /app/projects route renders it after its loader. The route also uses the skeleton and the error below.
// The status tab lives in the URL (?status=), so a link can open one tab.
import { WarningIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	formatRelativeTime,
	PersonAvatar,
	PROJECT_STATUSES,
	ProjectStateBadge,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Project, projectsQueryOptions } from "../api/projects.queries";
import { ProjectProgress } from "./project-progress";

const routeApi = getRouteApi("/app/projects/");

// A health sorts after the status: on track first, off track last among the active projects.
const STATE_ORDER = [
	"on-track",
	"at-risk",
	"off-track",
	"planned",
	"paused",
	"completed",
];

/** The list page. The status tab cuts the rows; then DataTable searches, sorts, and pages them. */
export function ProjectsPage() {
	const { t, locale } = useT();
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const { status } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();

	const tabs = PROJECT_STATUSES.map((value) => ({
		value,
		count: projects.filter((project) => project.status === value).length,
	})).filter((tab) => tab.count > 0);
	const rows = status
		? projects.filter((project) => project.status === status)
		: projects;
	const active = projects.filter((project) => project.status === "active");

	const columns: DataTableColumn<Project>[] = [
		{
			id: "project",
			header: t("projects.project"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="grid @4xl/main:min-w-64 justify-items-start gap-0.5">
					<Link
						to="/app/projects/$projectId"
						params={{ projectId: row.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.name}
					</Link>
					{/* The summary needs room: below the 4xl width it would push the last columns out of the card. */}
					<span className="text-muted-foreground text-xs">
						<span className="tabular-nums">{row.key}</span>
						<span className="@max-4xl/main:hidden"> · {row.summary}</span>
					</span>
					{/* On a phone the progress column is off-screen, so the progress shows under the name. The state column stays in view. */}
					<span className="@2xl/main:hidden pt-1">
						<ProjectProgress
							pointsDone={row.pointsDone}
							pointsTotal={row.pointsTotal}
							className="w-14"
						/>
					</span>
				</div>
			),
		},
		{
			id: "state",
			header: t("projects.state"),
			sortValue: (row) => STATE_ORDER.indexOf(row.health ?? row.status),
			cell: (row) => (
				<ProjectStateBadge status={row.status} health={row.health} />
			),
		},
		{
			id: "lead",
			header: t("projects.lead"),
			sortValue: (row) => row.leadName,
			cell: (row) => (
				// Below the 4xl width only the initials show, so every column fits the card at 1024 px and the phone sees the lead.
				<span
					className="flex items-center gap-2 whitespace-nowrap"
					title={row.leadName}
				>
					<PersonAvatar
						name={row.leadName}
						className="size-6 text-[0.625rem]"
					/>
					<bdi className="@max-4xl/main:sr-only">{row.leadName}</bdi>
				</span>
			),
		},
		{
			id: "progress",
			header: t("projects.progress"),
			sortValue: (row) =>
				row.pointsTotal === 0 ? 0 : row.pointsDone / row.pointsTotal,
			cell: (row) => (
				<ProjectProgress
					pointsDone={row.pointsDone}
					pointsTotal={row.pointsTotal}
				/>
			),
		},
		{
			id: "target",
			header: t("projects.target"),
			sortValue: (row) => Date.parse(row.targetAt),
			cell: (row) => (
				<span className="grid whitespace-nowrap">
					<span className="tabular-nums">
						{date.format(new Date(row.targetAt))}
					</span>
					{row.status === "active" || row.status === "planned" ? (
						<span className="text-muted-foreground text-xs">
							{formatRelativeTime(row.targetAt, now, locale)}
						</span>
					) : null}
				</span>
			),
		},
		{
			id: "open",
			header: t("projects.openTasks"),
			align: "end",
			sortValue: (row) => row.openCount,
			cell: (row) => (
				<span className="grid justify-items-end">
					<span className="font-medium">{number.format(row.openCount)}</span>
					{row.overdueCount > 0 && row.status === "active" ? (
						<span className="inline-flex items-center gap-1 text-destructive text-xs">
							<WarningIcon className="size-3" />
							{fillMessage(t("projects.overdue"), {
								count: number.format(row.overdueCount),
							})}
						</span>
					) : null}
				</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("projects.title")}
				description={fillMessage(t("projects.description"), {
					open: number.format(
						active.reduce((sum, project) => sum + project.openCount, 0),
					),
					active: number.format(active.length),
				})}
			/>
			<div className="grid gap-4">
				<Tabs
					value={status ?? "all"}
					onValueChange={(value) =>
						navigate({
							search: {
								status: PROJECT_STATUSES.find((option) => option === value),
							},
							replace: true,
						})
					}
					className="max-w-full overflow-x-auto"
				>
					<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
						{/* Narrow padding on a phone keeps all five tabs on the screen. */}
						<TabsTrigger value="all" className="@md/main:px-3 px-2">
							{t("projects.all")}
							<span className="text-muted-foreground tabular-nums">
								{number.format(projects.length)}
							</span>
						</TabsTrigger>
						{tabs.map((tab) => (
							<TabsTrigger
								key={tab.value}
								value={tab.value}
								className="@md/main:px-3 px-2"
							>
								{t(`projectStatus.${tab.value}`)}
								<span className="text-muted-foreground tabular-nums">
									{number.format(tab.count)}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<Card>
					<CardContent>
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) =>
								`${row.name} ${row.key} ${row.summary} ${row.leadName}`
							}
							noResults={t("projects.noResults")}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ProjectsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-64 max-w-full" />
			</div>
			<div className="grid gap-4">
				<Skeleton className="h-9 w-full max-w-lg" />
				<Card>
					<CardContent className="grid gap-3">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Error state of the list and of the project page when a loader fails. Try again runs the loader again. */
export function ProjectsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("projects.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
