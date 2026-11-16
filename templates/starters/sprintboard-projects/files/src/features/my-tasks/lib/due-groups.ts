// Groups the open tasks of one person by due day: overdue, today, this week, later, and no due day.
// Backlog tasks are not planned yet, so they go to their own last group and not to a due group.
// MyTasksPage builds the groups with groupByDue during render.
import {
	calendarDaysFromNow,
	isOverdue,
	TASK_PRIORITIES,
	type Task,
} from "~/features/tracker";

/** The group ids, in page order. The page reads the title `myTasks.group.<id>` from messages.ts. */
export const DUE_GROUPS = [
	"overdue",
	"today",
	"week",
	"later",
	"none",
	"backlog",
] as const;

/** One group id. */
export type DueGroup = (typeof DUE_GROUPS)[number];

// "This week" covers the next 7 calendar days after today.
const WEEK_DAYS = 7;

function groupOf(task: Task, now: number): DueGroup {
	if (task.status === "backlog") {
		return "backlog";
	}
	if (task.dueAt === null) {
		return "none";
	}
	if (isOverdue(task, now)) {
		return "overdue";
	}
	const days = calendarDaysFromNow(task.dueAt, now);
	return days <= 0 ? "today" : days <= WEEK_DAYS ? "week" : "later";
}

/** The non-empty groups in page order. Inside a group, the earliest due day comes first, then the highest priority. */
export function groupByDue(
	tasks: Task[],
	now: number,
): { id: DueGroup; tasks: Task[] }[] {
	return DUE_GROUPS.map((id) => ({
		id,
		tasks: tasks
			.filter((task) => groupOf(task, now) === id)
			.sort(
				(first, second) =>
					(first.dueAt ?? "").localeCompare(second.dueAt ?? "") ||
					TASK_PRIORITIES.indexOf(first.priority) -
						TASK_PRIORITIES.indexOf(second.priority),
			),
	})).filter((group) => group.tasks.length > 0);
}
