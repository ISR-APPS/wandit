// The project list behind login: four figures, the view tabs, a service filter, and the searchable table.
// The /app/projects route renders it after its loader, and also uses the skeleton and the error below.
// A project name opens /app/projects/$projectId.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	BurnMeter,
	daysFromToday,
	type Figure,
	FigureBand,
	HealthBadge,
	PageError,
	PersonAvatar,
	PhaseBadge,
	type ProjectSummary,
	SERVICES,
	type Service,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { useSidebar } from "~/shared/ui/sidebar";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { projectsQueryOptions } from "../api/projects.queries";
import {
	isInView,
	PROJECT_VIEWS,
	type ProjectView,
} from "../lib/project-filters";

/** The list page. The view tab and the service filter cut the rows; then DataTable searches, sorts, and pages them. */
export function ProjectsPage() {
	const { t, locale } = useT();
	const format = useFormatters();
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	// A phone shows two columns. The stage and the due day move under the project name.
	const { isMobile } = useSidebar();
	const [view, setView] = useState<ProjectView>("live");
	const [service, setService] = useState<Service | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const byService =
		service === "all"
			? projects
			: projects.filter((project) => project.service === service);
	const rows = byService.filter((project) => isInView(project, view));
	const live = projects.filter((project) => project.isLive);
	const fixedLive = live.filter((project) => project.dueDay !== null);
	const deliveredRecently = projects.filter(
		(project) =>
			!project.isLive &&
			project.dueDay !== null &&
			daysFromToday(project.dueDay) >= -90,
	);
	const figures: Figure[] = [
		{
			id: "live",
			label: t("projects.figures.live"),
			value: number.format(live.length),
		},
		{
			id: "fees",
			label: t("projects.figures.fees"),
			value: format.compactMoney(
				fixedLive.reduce((sum, project) => sum + project.budget, 0),
			),
		},
		{
			id: "risk",
			label: t("projects.figures.atRisk"),
			value: number.format(
				projects.filter((project) => isInView(project, "at_risk")).length,
			),
		},
		{
			id: "delivered",
			label: t("projects.figures.delivered"),
			value: number.format(deliveredRecently.length),
		},
	];

	/** The due cell: "Monthly" for a retainer, a relative day while live, a date once delivered. */
	const renderDue = (row: ProjectSummary) =>
		row.dueDay === null ? (
			<span className="text-muted-foreground">{t("projects.monthly")}</span>
		) : row.isLive ? (
			<span
				className={cn(
					daysFromToday(row.dueDay) < 0 && "font-medium text-destructive",
				)}
			>
				{format.relativeDay(row.dueDay)}
			</span>
		) : (
			format.shortDate(row.dueDay)
		);

	const columns: DataTableColumn<ProjectSummary>[] = [
		{
			id: "project",
			header: t("projects.project"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="grid justify-items-start">
					{/* min-h-11 gives the link a 44 px touch area on a phone. */}
					<Link
						to="/app/projects/$projectId"
						params={{ projectId: row.id }}
						className="inline-flex min-h-11 items-center font-medium hover:underline md:min-h-0"
					>
						{row.name}
					</Link>
					<span className="text-muted-foreground text-xs">
						{row.clientName}
					</span>
					{isMobile ? (
						<span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5 text-xs">
							{row.health ? (
								<HealthBadge health={row.health} />
							) : (
								<PhaseBadge phase={row.phase} />
							)}
							{renderDue(row)}
						</span>
					) : null}
				</div>
			),
		},
		{
			// Budget used comes second, so a phone shows it beside the name.
			id: "burn",
			header: t("projects.burn"),
			sortValue: (row) => row.burnShare,
			cell: (row) => (
				<div className="grid @3xl/main:w-40 w-24 gap-1.5">
					<div className="flex items-baseline justify-between gap-2 text-xs">
						<span
							className={cn(
								"font-medium tabular-nums",
								row.burnShare > 1 && "text-destructive",
							)}
						>
							{format.percent(row.burnShare)}
						</span>
						{/* A phone keeps the percent and the bar. The budget text needs the wide cell. */}
						<span className="@max-3xl/main:hidden text-muted-foreground tabular-nums">
							{row.dueDay === null
								? t("projects.ofMonthlyFee").replace(
										"{fee}",
										format.compactMoney(row.budget),
									)
								: t("projects.ofBudget").replace(
										"{budget}",
										format.compactMoney(row.budget),
									)}
						</span>
					</div>
					<BurnMeter
						burnShare={row.burnShare}
						elapsedShare={row.isLive ? row.elapsedShare : null}
					/>
				</div>
			),
		},
		{
			id: "stage",
			header: t("projects.stage"),
			sortValue: (row) => (row.health ? HEALTH_ORDER[row.health] : 9),
			cell: (row) => (
				<div className="flex flex-wrap gap-1.5">
					<PhaseBadge phase={row.phase} />
					{row.health ? <HealthBadge health={row.health} /> : null}
				</div>
			),
		},
		{
			id: "due",
			header: t("projects.due"),
			sortValue: (row) =>
				row.dueDay === null
					? Number.MAX_SAFE_INTEGER
					: daysFromToday(row.dueDay),
			cell: renderDue,
		},
		{
			id: "lead",
			header: t("projects.lead"),
			sortValue: (row) => row.leadName,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<PersonAvatar
						name={row.leadName}
						className="size-6 text-[0.625rem]"
					/>
					{row.leadName}
				</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("projects.title")}
				description={t("projects.description")}
			/>
			<FigureBand figures={figures} />
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={isMobile ? columns.slice(0, 2) : columns}
						searchText={(row) =>
							`${row.name} ${row.clientName} ${row.leadName}`
						}
						noResults={t("projects.noResults")}
						toolbar={
							<>
								<Tabs
									value={view}
									onValueChange={(value) =>
										setView(
											PROJECT_VIEWS.find((option) => option === value) ??
												"live",
										)
									}
									className="max-w-full overflow-x-auto"
								>
									<TabsList>
										{PROJECT_VIEWS.map((option) => (
											<TabsTrigger key={option} value={option}>
												{t(`projects.views.${option}`)}
												<span className="tabular-nums opacity-60">
													{number.format(
														byService.filter((project) =>
															isInView(project, option),
														).length,
													)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={service}
									onValueChange={(value) =>
										setService(
											SERVICES.find((option) => option === value) ?? "all",
										)
									}
								>
									<SelectTrigger
										className="w-44"
										aria-label={t("projects.service")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("projects.allServices")}
										</SelectItem>
										{SERVICES.map((option) => (
											<SelectItem key={option} value={option}>
												{t(`codes.services.${option}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{/* The burn bars have a tick. This key explains it, as the detail page does. */}
								<span className="ms-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
									<span className="flex items-center gap-1.5">
										<span className="h-1.5 w-4 rounded-full bg-primary" />
										{t("projects.burn")}
									</span>
									<span className="flex items-center gap-1.5">
										<span className="h-3 w-0.5 rounded-full bg-chart-3" />
										{t("projects.timePassed")}
									</span>
								</span>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

/** Sort order of the stage column: the worst health first. */
const HEALTH_ORDER = { over_budget: 0, at_risk: 1, on_track: 2 } as const;

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ProjectsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-80" />
			</div>
			<Skeleton className="h-20 rounded-surface" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the project pages when a loader fails. Try again runs the loader again. */
export function ProjectsPageError() {
	const { t } = useT();
	return <PageError message={t("projects.loadError")} />;
}
