// The follow-up table of the Activities page: every open task of the team, with status and priority filters.
// ActivitiesPage renders it in the "Follow-ups" tab and passes the cached tasks.
// It follows the task list page of the kit: a status icon and word, a priority badge, and a row menu.
import {
	CalendarCheckIcon,
	CircleIcon,
	DownloadSimpleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	PersonAvatar,
	PriorityBadge,
	TASK_DUE_STATES,
	TASK_PRIORITIES,
	type TaskDueState,
	taskDueState,
	toCsv,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import type { KitIcon } from "~/shared/ui/icons";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import type { Task } from "../api/tasks.queries";

/** The icon and the text color of each due state. The word always shows beside the icon. */
const DUE_STATE_LOOK = {
	overdue: { icon: WarningCircleIcon, className: "text-destructive" },
	today: { icon: CalendarCheckIcon, className: "text-warning" },
	upcoming: { icon: CircleIcon, className: "text-muted-foreground" },
} satisfies Record<TaskDueState, { icon: KitIcon; className: string }>;

type FollowUpsTableProps = {
	/** Every open task of the team, the most urgent first. */
	tasks: Task[];
	/** The current time in milliseconds since 1970. The due states count from it. */
	now: number;
};

/** The status and priority filters cut the rows; then RecordTable filters, sorts, and pages them. */
export function FollowUpsTable({ tasks, now }: FollowUpsTableProps) {
	const { t, locale } = useT();
	const [state, setState] = useState<string | null>(null);
	const [priority, setPriority] = useState<string | null>(null);
	const rows = tasks.filter(
		(task) =>
			(state === null || taskDueState(task.dueAt, now) === state) &&
			(priority === null || task.priority === priority),
	);
	const timeOfDay = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	const csvColumns: CsvColumn<Task>[] = [
		{ header: t("tasks.task"), value: (task) => task.title },
		{ header: t("deals.deal"), value: (task) => task.deal.name },
		{ header: t("deals.company"), value: (task) => task.companyName },
		{
			header: t("tasks.status"),
			value: (task) => t(`tasks.states.${taskDueState(task.dueAt, now)}`),
		},
		{
			header: t("tasks.priority"),
			value: (task) => t(`tasks.priorities.${task.priority}`),
		},
		{ header: t("tasks.assignee"), value: (task) => task.assigneeName },
		{ header: t("tasks.due"), value: (task) => task.dueAt },
	];

	const columns: RecordColumn<Task>[] = [
		{
			id: "task",
			header: t("tasks.task"),
			sortValue: (task) => task.title,
			cell: (task) => (
				<div className="grid justify-items-start">
					<span className="font-medium">{task.title}</span>
					<Link
						to="/app/deals/$dealId"
						params={{ dealId: task.deal.id }}
						className="max-w-64 truncate text-muted-foreground text-xs hover:text-foreground hover:underline"
						dir="auto"
					>
						{`${task.deal.name} · ${task.companyName}`}
					</Link>
				</div>
			),
		},
		{
			id: "status",
			header: t("tasks.status"),
			sortValue: (task) =>
				TASK_DUE_STATES.indexOf(taskDueState(task.dueAt, now)),
			cell: (task) => {
				const dueState = taskDueState(task.dueAt, now);
				const look = DUE_STATE_LOOK[dueState];
				return (
					<span
						className={cn("inline-flex items-center gap-1.5", look.className)}
					>
						<look.icon className="size-4" />
						{t(`tasks.states.${dueState}`)}
					</span>
				);
			},
		},
		{
			id: "priority",
			header: t("tasks.priority"),
			sortValue: (task) => TASK_PRIORITIES.indexOf(task.priority),
			cell: (task) => <PriorityBadge priority={task.priority} />,
		},
		{
			id: "assignee",
			header: t("tasks.assignee"),
			hideable: true,
			sortValue: (task) => task.assigneeName,
			cell: (task) => (
				<span className="flex items-center gap-2">
					<PersonAvatar name={task.assigneeName} className="size-6 text-xs" />
					<bdi>{task.assigneeName}</bdi>
				</span>
			),
		},
		{
			id: "due",
			header: t("tasks.due"),
			hideable: true,
			align: "end",
			sortValue: (task) => Date.parse(task.dueAt),
			cell: (task) => (
				<time dateTime={task.dueAt} className="text-muted-foreground">
					{/* "today" says nothing new beside the status, so a task of today shows its hour. */}
					{taskDueState(task.dueAt, now) === "today"
						? timeOfDay.format(new Date(task.dueAt))
						: formatRelativeTime(task.dueAt, now, locale)}
				</time>
			),
		},
	];

	return (
		<RecordTable
			rows={rows}
			columns={columns}
			searchText={(task) =>
				`${task.title} ${task.deal.name} ${task.companyName} ${task.assigneeName}`
			}
			searchPlaceholder={t("tasks.filterPlaceholder")}
			toolbar={
				<>
					<RecordFilter
						label={t("tasks.status")}
						options={TASK_DUE_STATES.map((value) => ({
							value,
							label: t(`tasks.states.${value}`),
						}))}
						value={state}
						onValueChange={setState}
					/>
					<RecordFilter
						label={t("tasks.priority")}
						options={TASK_PRIORITIES.map((value) => ({
							value,
							label: t(`tasks.priorities.${value}`),
						}))}
						value={priority}
						onValueChange={setPriority}
					/>
				</>
			}
			pageSize={20}
			noResults={t("tasks.noResults")}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"follow-ups-selected.csv",
							toCsv(selectedRows, csvColumns),
						)
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			rowMenu={(task) => (
				<>
					<DropdownMenuItem asChild>
						<Link to="/app/deals/$dealId" params={{ dealId: task.deal.id }}>
							{t("deals.openDeal")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(task.id, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("tasks.copyId")}
					</DropdownMenuItem>
				</>
			)}
		/>
	);
}
