// The Tasks page: every task of every project in one table, with a text filter, four filter buttons,
// sortable heads, row checkboxes, a row menu, and pages of 25. The /app/tasks route renders it after its loader.
// The filters are local state. The rows are filtered during render, then RecordTable sorts and pages them.
// "Open" in a row menu opens the task dialog of the tracker.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	DAY_MS,
	downloadCsv,
	fillMessage,
	isDueBetween,
	isOverdue,
	TASK_PRIORITIES,
	TASK_PRIORITY_ICON,
	TASK_STATUS_ICON,
	TASK_STATUSES,
	type Task,
	TaskDialog,
	tasksQueryOptions,
	toCsv,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { taskCsvColumns } from "../lib/task-csv";

/** Rows per page, as the kit task list. */
const PAGE_SIZE = 25;

/** The values of the "Due" filter. */
type DueFilter = "overdue" | "week";

// The task passes the "Due" filter. "overdue" uses isOverdue, so it counts the same tasks as the bell.
// "week" uses isDueBetween, so it counts the same tasks as the "Tasks due this week" KPI of the home.
function matchesDue(task: Task, due: DueFilter | null, now: number): boolean {
	if (due === null) {
		return true;
	}
	if (due === "overdue") {
		return isOverdue(task, now);
	}
	return isDueBetween(task, now, now + 7 * DAY_MS);
}

/** Every filter narrows the rows. A filter button shows its chosen value as a badge. */
export function TasksPage() {
	const { t, locale } = useT();
	const { data: tasks } = useSuspenseQuery(tasksQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [priority, setPriority] = useState<string | null>(null);
	const [project, setProject] = useState<string | null>(null);
	const [due, setDue] = useState<DueFilter | null>(null);
	const [openTask, setOpenTask] = useState<Task | null>(null);
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);

	const projectOptions = [
		...new Map(
			tasks.map((task) => [task.projectId, task.projectName]),
		).entries(),
	]
		.map(([value, label]) => ({ value, label }))
		.sort((first, second) => first.label.localeCompare(second.label, locale));
	const rows = tasks.filter(
		(task) =>
			(status === null || task.status === status) &&
			(priority === null || task.priority === priority) &&
			(project === null || task.projectId === project) &&
			matchesDue(task, due, now),
	);
	const openCount = tasks.filter((task) => task.status !== "done").length;

	const columns: RecordColumn<Task>[] = [
		{
			id: "key",
			header: t("tasks.key"),
			cell: (task) => (
				<span className="whitespace-nowrap tabular-nums">{task.key}</span>
			),
		},
		{
			id: "title",
			header: t("tasks.titleColumn"),
			cell: (task) => (
				<span className="flex min-w-0 items-center gap-2">
					<Badge variant="outline">{t(`kind.${task.kind}`)}</Badge>
					<button
						type="button"
						onClick={() => setOpenTask(task)}
						className="max-w-md truncate text-start font-medium hover:underline"
						dir="auto"
					>
						{task.title}
					</button>
				</span>
			),
			sortValue: (task) => task.title,
		},
		{
			id: "status",
			header: t("tasks.status"),
			cell: (task) => {
				const StatusIcon = TASK_STATUS_ICON[task.status];
				return (
					<span className="flex items-center gap-2 whitespace-nowrap">
						<StatusIcon className="size-4 text-muted-foreground" />
						{t(`status.${task.status}`)}
					</span>
				);
			},
			sortValue: (task) => TASK_STATUSES.indexOf(task.status),
			hideable: true,
		},
		{
			id: "priority",
			header: t("tasks.priority"),
			cell: (task) => {
				const PriorityIcon = TASK_PRIORITY_ICON[task.priority];
				return (
					<span className="flex items-center gap-2 whitespace-nowrap">
						<PriorityIcon className="size-4 text-muted-foreground" />
						{t(`priority.${task.priority}`)}
					</span>
				);
			},
			// Urgent sorts first in the ascending order.
			sortValue: (task) => TASK_PRIORITIES.indexOf(task.priority),
			hideable: true,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("tasks.title")}
				description={fillMessage(t("tasks.description"), {
					open: number.format(openCount),
					total: number.format(tasks.length),
				})}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("tasks.csv", toCsv(rows, taskCsvColumns(t, locale)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<RecordTable<Task>
				rows={rows}
				columns={columns}
				searchText={(task) => `${task.key} ${task.title}`}
				searchPlaceholder={t("tasks.filter")}
				toolbar={
					<>
						<RecordFilter
							label={t("tasks.status")}
							options={TASK_STATUSES.map((value) => ({
								value,
								label: t(`status.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("tasks.priority")}
							options={TASK_PRIORITIES.map((value) => ({
								value,
								label: t(`priority.${value}`),
							}))}
							value={priority}
							onValueChange={setPriority}
						/>
						<RecordFilter
							label={t("task.project")}
							options={projectOptions}
							value={project}
							onValueChange={setProject}
						/>
						<RecordFilter
							label={t("tasks.due")}
							options={[
								{ value: "overdue", label: t("tasks.dueOverdue") },
								{ value: "week", label: t("tasks.dueWeek") },
							]}
							value={due}
							onValueChange={(value) =>
								setDue(value === "overdue" || value === "week" ? value : null)
							}
						/>
					</>
				}
				rowMenu={(task) => (
					<>
						<DropdownMenuItem onSelect={() => setOpenTask(task)}>
							{t("table.open")}
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link
								to="/app/projects/$projectId"
								params={{ projectId: task.projectId }}
								search={{ tab: "board" }}
							>
								{t("tasks.openBoard")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(task.key, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("table.copyKey")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"tasks-selected.csv",
								toCsv(selected, taskCsvColumns(t, locale)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("tasks.noResults")}
			/>
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

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function TasksPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full max-w-2xl" />
			<Skeleton className="h-150" />
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function TasksPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("tasks.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
