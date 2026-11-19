// The page of one project: a back link, the title with the export button, then the tabs Overview and Board.
// Overview: the profile, completion, and task mix cards (1/3), the milestones, recent tasks, and people (2/3).
// Board: the task board of the project. The /app/projects/$projectId route renders it after its loader.
// A task title or a board card opens the task dialog of the tracker.
import {
	ArrowLeftIcon,
	DownloadSimpleIcon,
	FolderSimpleDashedIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { taskCsvColumns } from "~/features/tasks";
import { downloadCsv, type Task, TaskDialog, toCsv } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { projectQueryOptions } from "../api/projects.queries";
import { projectTabSchema } from "../lib/project-search";
import { CompletionCard } from "./completion-card";
import { MilestonesCard } from "./milestones-card";
import { ProjectBoard } from "./project-board";
import { ProjectPeopleCard } from "./project-people-card";
import { ProjectProfileCard } from "./project-profile-card";
import { RecentTasksCard } from "./recent-tasks-card";
import { TaskMixCard } from "./task-mix-card";

/** `projectId` comes from the URL. An unknown id shows a centered "not found" card with a link to the list. */
export function ProjectDetailPage({ projectId }: { projectId: string }) {
	const { t, locale } = useT();
	const { tab } = useSearch({ from: "/app/projects/$projectId" });
	const navigate = useNavigate({ from: "/app/projects/$projectId" });
	const { data: project } = useSuspenseQuery(projectQueryOptions(projectId));
	const [openTask, setOpenTask] = useState<Task | null>(null);

	if (!project) {
		return (
			<Card className="mx-auto mt-6 w-full max-w-md">
				<CardContent className="grid justify-items-center gap-3 py-6 text-center">
					<span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
						<FolderSimpleDashedIcon className="size-6" />
					</span>
					<h1 className="font-display font-semibold text-xl">
						{t("project.notFound")}
					</h1>
					<p className="text-muted-foreground text-sm">
						{t("project.notFoundNote")}
					</p>
					<Button asChild variant="outline" className="mt-2">
						<Link to="/app/projects">{t("project.backToList")}</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	const now = Date.now();

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Link
					to="/app/projects"
					className="inline-flex min-h-9 items-center gap-1.5 justify-self-start text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4 rtl:rotate-180" />
					{t("projects.title")}
				</Link>
				<PageHeader
					title={project.name}
					actions={
						<Button
							type="button"
							aria-label={t("project.exportTasks")}
							onClick={() =>
								downloadCsv(
									`${project.key.toLocaleLowerCase("en")}-tasks.csv`,
									toCsv(project.tasks, taskCsvColumns(t, locale)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">
								{t("project.exportTasks")}
							</span>
						</Button>
					}
				/>
			</div>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					const next = projectTabSchema.safeParse(value);
					if (next.success) {
						navigate({ search: { tab: next.data }, replace: true });
					}
				}}
				className="gap-4"
			>
				<TabsList>
					<TabsTrigger value="overview">{t("project.tabOverview")}</TabsTrigger>
					<TabsTrigger value="board">{t("project.tabBoard")}</TabsTrigger>
				</TabsList>
				<TabsContent
					value="overview"
					className="grid @4xl/main:grid-cols-3 gap-4"
				>
					<div className="grid content-start gap-4">
						<ProjectProfileCard project={project} now={now} />
						<CompletionCard project={project} />
						<TaskMixCard tasks={project.tasks} />
					</div>
					<div className="@4xl/main:col-span-2 grid min-w-0 content-start gap-4">
						<MilestonesCard
							projectId={project.id}
							milestones={project.milestones}
							now={now}
						/>
						<div className="grid @5xl/main:grid-cols-2 gap-4">
							<RecentTasksCard tasks={project.tasks} onOpenTask={setOpenTask} />
							<ProjectPeopleCard
								members={project.members}
								leadId={project.leadId}
								tasks={project.tasks}
							/>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="board" className="min-w-0">
					<ProjectBoard
						tasks={project.tasks}
						members={project.members}
						now={now}
						onOpenTask={setOpenTask}
					/>
				</TabsContent>
			</Tabs>
			<TaskDialog
				task={openTask}
				onOpenChange={(open) => {
					if (!open) {
						setOpenTask(null);
					}
				}}
			/>
		</div>
	);
}

/** Placeholder while the loader runs: the header, the tabs, and the two columns of the Overview tab. */
export function ProjectDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-5 w-24" />
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-9 w-36" />
			</div>
			<Skeleton className="h-9 w-44" />
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-120" />
				<Skeleton className="@4xl/main:col-span-2 h-120" />
			</div>
		</div>
	);
}
