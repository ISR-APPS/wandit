// The task board of a project page: one column per status, with the cards in work order.
// ProjectDetailPage builds the board with buildBoard during render. The columns read no other data.
import {
	periodOf,
	TASK_PRIORITIES,
	TASK_STATUSES,
	type Task,
	type TaskStatus,
} from "~/features/tracker";

/** The Done column shows the tasks done in the last 14 full days (periodOf). Older done tasks stay in the project totals. */
export const DONE_WINDOW_DAYS = 14;

/** A column shows this many cards before its "Show N more" button. */
export const COLUMN_CARDS = 6;

/** One column of the board. */
export type BoardColumn = {
	status: TaskStatus;
	tasks: Task[];
	/** The sum of the estimates of the cards, in story points. */
	points: number;
};

// No due day sorts after every due day.
function dueValue(task: Task): number {
	return task.dueAt === null
		? Number.POSITIVE_INFINITY
		: Date.parse(task.dueAt);
}

/**
 * The columns in status order. Open columns sort by priority, then by due day.
 * The Done column holds the tasks of the last DONE_WINDOW_DAYS days, the newest first.
 */
export function buildBoard(tasks: Task[], now: number): BoardColumn[] {
	return TASK_STATUSES.map((status) => {
		const inColumn = tasks.filter((task) => task.status === status);
		const sorted =
			status === "done"
				? inColumn
						.filter(
							(task) =>
								task.completedAt !== null &&
								periodOf(task.completedAt, DONE_WINDOW_DAYS, now) === "current",
						)
						.sort((first, second) =>
							(second.completedAt ?? "").localeCompare(first.completedAt ?? ""),
						)
				: inColumn.sort(
						(first, second) =>
							TASK_PRIORITIES.indexOf(first.priority) -
								TASK_PRIORITIES.indexOf(second.priority) ||
							dueValue(first) - dueValue(second),
					);
		return {
			status,
			tasks: sorted,
			points: sorted.reduce((sum, task) => sum + task.estimate, 0),
		};
	});
}
