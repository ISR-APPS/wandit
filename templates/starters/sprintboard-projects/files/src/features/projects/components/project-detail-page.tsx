// The page of one project: the header with its state, four facts, the task board, the milestones, and the people.
// The /app/projects/$projectId route renders it after its loader. The route also uses the skeleton below.
// The board filters by assignee and by text in local state. A card opens the task dialog.
import {
	ArrowLeftIcon,
	FolderSimpleDashedIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	formatRelativeTime,
	ProjectStateBadge,
	TASK_STATUSES,
	type Task,
	TaskDialog,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { projectQueryOptions } from "../api/projects.queries";
import { buildBoard } from "../lib/board";
import { BoardColumn } from "./board-column";
import { MilestonesCard } from "./milestones-card";
import { ProjectPeopleCard } from "./project-people-card";
import { ProjectProgress } from "./project-progress";

// The assignee filter value for "every person" and for "nobody".
const EVERYONE = "everyone";
const UNASSIGNED = "unassigned";

/** `projectId` comes from the URL. An unknown id shows a centered "not found" card with a link to the list. */
export function ProjectDetailPage({ projectId }: { projectId: string }) {
	const { t, locale } = useT();
	const { data: project } = useSuspenseQuery(projectQueryOptions(projectId));
	const [assignee, setAssignee] = useState(EVERYONE);
	const [query, setQuery] = useState("");
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
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const needle = query.trim().toLocaleLowerCase(locale);
	const shownTasks = project.tasks.filter(
		(task) =>
			(assignee === EVERYONE ||
				(assignee === UNASSIGNED
					? task.assigneeId === null
					: task.assigneeId === assignee)) &&
			(needle === "" ||
				`${task.key} ${task.title}`.toLocaleLowerCase(locale).includes(needle)),
	);
	const board = buildBoard(shownTasks, now);
	const nextMilestone = project.milestones.find(
		(milestone) => milestone.doneAt === null,
	);
	const isTargetPast = Date.parse(project.targetAt) < now;
	const unassignedCount = project.tasks.filter(
		(task) => task.assigneeId === null && task.status !== "done",
	).length;

	return (
		<div className="grid gap-6">
			<div className="grid gap-3">
				<Link
					to="/app/projects"
					className="inline-flex @3xl/main:min-h-9 min-h-11 items-center gap-1.5 justify-self-start text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4 rtl:rotate-180" />
					{t("projects.title")}
				</Link>
				<PageHeader
					title={project.name}
					description={project.summary}
					actions={
						<span className="flex items-center gap-2">
							<span className="rounded-badge border px-2 py-0.5 font-medium text-muted-foreground text-xs tabular-nums">
								{project.key}
							</span>
							<ProjectStateBadge
								status={project.status}
								health={project.health}
							/>
						</span>
					}
				/>
			</div>

			{/* gap-px on a border fill draws one hairline between the cells, for 2 or 4 columns. */}
			<Card className="grid @4xl/main:grid-cols-4 grid-cols-2 gap-px overflow-hidden bg-border py-0">
				<Fact label={t("project.progress")}>
					<ProjectProgress
						pointsDone={project.pointsDone}
						pointsTotal={project.pointsTotal}
						className="w-full max-w-40"
					/>
					<span className="text-muted-foreground text-xs tabular-nums">
						{fillMessage(t("project.pointsDone"), {
							done: number.format(project.pointsDone),
							total: number.format(project.pointsTotal),
						})}
					</span>
				</Fact>
				<Fact label={t("project.openTasks")}>
					<span className="font-numeric font-semibold text-xl tabular-nums">
						{number.format(project.openCount)}
					</span>
					<span
						className={cn(
							"inline-flex items-center gap-1 text-xs",
							project.overdueCount > 0
								? "text-destructive"
								: "text-muted-foreground",
						)}
					>
						{project.overdueCount > 0 ? (
							<WarningIcon className="size-3.5" />
						) : null}
						{fillMessage(t("projects.overdue"), {
							count: number.format(project.overdueCount),
						})}
					</span>
				</Fact>
				<Fact label={t("project.target")}>
					<span className="font-numeric font-semibold text-xl tabular-nums">
						{date.format(new Date(project.targetAt))}
					</span>
					<span
						className={cn(
							"text-xs",
							isTargetPast && project.status !== "completed"
								? "text-destructive"
								: "text-muted-foreground",
						)}
					>
						{project.status === "completed" && project.endedAt
							? fillMessage(t("project.shipped"), {
									date: date.format(new Date(project.endedAt)),
								})
							: formatRelativeTime(project.targetAt, now, locale)}
					</span>
				</Fact>
				<Fact label={t("project.nextMilestone")}>
					{nextMilestone ? (
						<>
							<span className="line-clamp-1 font-medium text-sm" dir="auto">
								{nextMilestone.name}
							</span>
							<span
								className={cn(
									"text-xs tabular-nums",
									Date.parse(nextMilestone.dueAt) < now
										? "text-destructive"
										: "text-muted-foreground",
								)}
							>
								{`${date.format(new Date(nextMilestone.dueAt))} · ${formatRelativeTime(nextMilestone.dueAt, now, locale)}`}
							</span>
						</>
					) : (
						<span className="text-muted-foreground text-sm">
							{t("project.allMilestonesDone")}
						</span>
					)}
				</Fact>
			</Card>

			<section aria-labelledby="board-title" className="grid gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<h2 id="board-title" className="me-auto font-semibold text-lg">
						{t("board.title")}
					</h2>
					<div className="relative w-full sm:w-56">
						<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("board.search")}
							aria-label={t("board.search")}
							className="ps-8"
						/>
					</div>
					<Select value={assignee} onValueChange={setAssignee}>
						<SelectTrigger
							aria-label={t("board.assignee")}
							className="w-full sm:w-48"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={EVERYONE}>{t("board.everyone")}</SelectItem>
							{project.members.map((member) => (
								<SelectItem key={member.id} value={member.id}>
									{member.name}
								</SelectItem>
							))}
							<SelectItem value={UNASSIGNED}>{t("task.unassigned")}</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{/* One column per status. The board scrolls sideways inside its own box when the columns do not fit. */}
				<div className="grid @5xl/main:snap-none snap-x snap-mandatory auto-cols-[minmax(13.5rem,1fr)] grid-flow-col items-start gap-3 overflow-x-auto pb-2">
					{board.map((column) => (
						<BoardColumn
							// A new filter shows each column folded again.
							key={`${column.status}:${assignee}:${needle}`}
							column={column}
							now={now}
							onOpenTask={setOpenTask}
						/>
					))}
				</div>
			</section>

			{/* items-start: each card keeps its own height, so a short list leaves no empty card area. */}
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				<MilestonesCard milestones={project.milestones} />
				<ProjectPeopleCard
					members={project.members}
					leadId={project.leadId}
					tasks={project.tasks}
					unassignedCount={unassignedCount}
				/>
			</div>
			<TaskDialog task={openTask} onOpenChange={() => setOpenTask(null)} />
		</div>
	);
}

/** One cell of the facts strip: a small label, then the value lines. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid min-w-0 content-start gap-1.5 bg-card px-4 py-4 sm:px-5">
			<span className="label-text text-muted-foreground text-xs">{label}</span>
			{children}
		</div>
	);
}

/** Placeholder while the loader runs: the header, the facts, and five board columns. */
export function ProjectDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-3">
				<Skeleton className="h-5 w-20" />
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<Skeleton className="h-24 rounded-surface" />
			<div className="grid auto-cols-[minmax(13.5rem,1fr)] grid-flow-col gap-3 overflow-hidden">
				{TASK_STATUSES.map((status) => (
					<div key={status} className="grid content-start gap-2">
						<Skeleton className="h-14" />
						<Skeleton className="h-28" />
						<Skeleton className="h-28" />
					</div>
				))}
			</div>
		</div>
	);
}
