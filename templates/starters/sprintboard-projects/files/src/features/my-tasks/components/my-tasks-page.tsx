// My tasks: the tasks of the signed-in person, grouped by due day, with a rail for the load and the projects.
// The /app/tasks route renders it after its loader. The route also uses the skeleton and the error below.
// The person is CURRENT_MEMBER_ID of the sample tables. A real app uses the id of the auth user (STARTER.md).
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { projectsQueryOptions } from "~/features/projects";
import {
	CapacityMeter,
	CURRENT_MEMBER_ID,
	dayCountFormat,
	fillMessage,
	isCommitted,
	membersQueryOptions,
	periodOf,
	type Task,
	TaskDialog,
	tasksQueryOptions,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { groupByDue } from "../lib/due-groups";
import { MyTaskRow } from "./my-task-row";

// The Done tab lists the tasks done in the last 30 full days, with the window rule of the overview.
const DONE_DAYS = 30;

/** "Open" shows the groups by due day. "Done" shows the work of the last 30 days, the newest first. */
export function MyTasksPage() {
	const { t, locale } = useT();
	const { data: tasks } = useSuspenseQuery(tasksQueryOptions());
	const { data: members } = useSuspenseQuery(membersQueryOptions());
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const [view, setView] = useState<"open" | "done">("open");
	const [openTask, setOpenTask] = useState<Task | null>(null);
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);

	const me = members.find((member) => member.id === CURRENT_MEMBER_ID);
	const mine = tasks.filter((task) => task.assigneeId === CURRENT_MEMBER_ID);
	const open = mine.filter((task) => task.status !== "done");
	const done = mine
		.filter(
			(task) =>
				task.completedAt !== null &&
				periodOf(task.completedAt, DONE_DAYS, now) === "current",
		)
		.sort((first, second) =>
			(second.completedAt ?? "").localeCompare(first.completedAt ?? ""),
		);
	const groups = groupByDue(open, now);
	const committedPoints = open
		.filter((task) => isCommitted(task.status))
		.reduce((sum, task) => sum + task.estimate, 0);
	// One entry per project with open work of the person, the most open tasks first.
	const byProject = projects
		.map((project) => ({
			project,
			count: open.filter((task) => task.projectId === project.id).length,
		}))
		.filter((entry) => entry.count > 0)
		.sort((first, second) => second.count - first.count);
	const statusCounts = (
		["todo", "in-progress", "in-review", "backlog"] as const
	).map((id) => ({
		id,
		label: t(`status.${id}`),
		count: open.filter((task) => task.status === id).length,
	}));

	const rows = (list: Task[]) => (
		<ul className="grid">
			{list.map((task) => (
				<li key={task.id}>
					<MyTaskRow task={task} now={now} onOpen={() => setOpenTask(task)} />
				</li>
			))}
		</ul>
	);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("myTasks.title")}
				description={fillMessage(t("myTasks.description"), {
					open: number.format(open.length),
					projects: number.format(byProject.length),
				})}
				actions={
					<Tabs
						value={view}
						onValueChange={(value) =>
							setView(value === "done" ? "done" : "open")
						}
					>
						<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
							<TabsTrigger value="open" className="px-3">
								{t("myTasks.open")}
								<span className="text-muted-foreground tabular-nums">
									{number.format(open.length)}
								</span>
							</TabsTrigger>
							<TabsTrigger value="done" className="px-3">
								{fillMessage(t("myTasks.done"), {
									period: dayCountFormat(locale).format(DONE_DAYS),
								})}
								<span className="text-muted-foreground tabular-nums">
									{number.format(done.length)}
								</span>
							</TabsTrigger>
						</TabsList>
					</Tabs>
				}
			/>
			<div className="grid @4xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				{/* On a phone the load card comes first: it is the main fact of the page. */}
				<div className="@4xl/main:order-none order-last grid gap-4">
					{view === "open" ? (
						groups.length === 0 ? (
							<Card>
								<CardContent className="py-8 text-center text-muted-foreground text-sm">
									{t("myTasks.noOpen")}
								</CardContent>
							</Card>
						) : (
							groups.map((group) => (
								<Card key={group.id} className="gap-2 py-4">
									<CardHeader className="flex items-center gap-2 px-6">
										<CardTitle
											className={cn(
												"text-sm",
												group.id === "overdue" && "text-destructive",
											)}
										>
											{t(`myTasks.group.${group.id}`)}
										</CardTitle>
										<span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground text-xs tabular-nums">
											{number.format(group.tasks.length)}
										</span>
									</CardHeader>
									<CardContent className="px-3">
										{rows(group.tasks)}
									</CardContent>
								</Card>
							))
						)
					) : (
						<Card className="gap-2 py-4">
							<CardContent className="px-3">
								{done.length === 0 ? (
									<p className="py-8 text-center text-muted-foreground text-sm">
										{t("myTasks.noDone")}
									</p>
								) : (
									rows(done)
								)}
							</CardContent>
						</Card>
					)}
				</div>

				<div className="grid gap-4">
					<Card className="gap-4">
						<CardHeader>
							<CardTitle>{t("myTasks.loadTitle")}</CardTitle>
							<CardDescription>{t("myTasks.loadNote")}</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4">
							<div className="grid gap-2">
								<p className="flex items-baseline gap-1.5">
									<span className="font-numeric font-semibold text-3xl tabular-nums">
										{number.format(committedPoints)}
									</span>
									<span className="text-muted-foreground text-sm">
										{fillMessage(t("myTasks.ofCapacity"), {
											capacity: number.format(me?.capacity ?? 0),
										})}
									</span>
								</p>
								<CapacityMeter
									points={committedPoints}
									capacity={me?.capacity ?? 0}
									className="w-full"
								/>
							</div>
							<dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4">
								{statusCounts.map((entry) => (
									<div key={entry.id} className="grid gap-0.5">
										<dt className="label-text text-muted-foreground text-xs">
											{entry.label}
										</dt>
										<dd className="font-numeric font-semibold text-lg tabular-nums">
											{number.format(entry.count)}
										</dd>
									</div>
								))}
							</dl>
						</CardContent>
					</Card>
					<Card className="gap-3">
						<CardHeader>
							<CardTitle>{t("myTasks.projectsTitle")}</CardTitle>
						</CardHeader>
						<CardContent className="px-3">
							<ul className="grid">
								{byProject.map(({ project, count }) => (
									<li key={project.id}>
										<Link
											to="/app/projects/$projectId"
											params={{ projectId: project.id }}
											className="flex min-h-10 items-center gap-3 rounded-control px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
										>
											{/* A fixed width keeps the names in one column, whatever the key length. */}
											<span className="w-10 shrink-0 rounded-badge border px-1.5 py-0.5 text-center font-medium text-muted-foreground text-xs tabular-nums">
												{project.key}
											</span>
											<span className="min-w-0 flex-1 truncate">
												{project.name}
											</span>
											<span className="text-muted-foreground tabular-nums">
												{fillMessage(t("project.openCount"), {
													count: number.format(count),
												})}
											</span>
										</Link>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				</div>
			</div>
			<TaskDialog task={openTask} onOpenChange={() => setOpenTask(null)} />
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the loader runs: the header, one group of rows, and the rail. */
export function MyTasksPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-56" />
			</div>
			<div className="grid @4xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 gap-4">
				<Card>
					<CardContent className="grid gap-3">
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-11 w-full" />
						))}
					</CardContent>
				</Card>
				<Skeleton className="h-64 rounded-surface" />
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function MyTasksPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("myTasks.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
