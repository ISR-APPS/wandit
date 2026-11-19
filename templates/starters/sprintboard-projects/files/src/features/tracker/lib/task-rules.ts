// Tracker rules that more than one page applies: when a task is late or due, and its cycle time.
// The board, the Team page, the project list, the task dialog, the alerts, the home, and the Tasks page call them.
import type { TaskStatus } from "./codes";
import { DAY_MS } from "./time";

/** The task fields that the rules read. */
type TaskTimes = {
	status: TaskStatus;
	dueAt: string | null;
	/** The time the task was written, ISO 8601. A task does not exist before it. */
	createdAt: string;
	startedAt: string | null;
	completedAt: string | null;
};

/**
 * A task is overdue when its due time (17:00 of the due day) has passed and it is open and planned.
 * Backlog work is not planned yet, so it is never late.
 */
export function isOverdue(task: TaskTimes, now: number): boolean {
	return (
		task.status !== "done" &&
		task.status !== "backlog" &&
		task.dueAt !== null &&
		Date.parse(task.dueAt) < now
	);
}

/**
 * A task is due in [start, end) when it is planned, its due time is in the window, and it is open at start.
 * The "due this week" KPI, the Tasks filter, and the Reminders link use this one rule, so their counts agree.
 * A task done before start is not due any more. A task done later was still due at start.
 * A task written after start does not count, so a past window counts only the tasks that existed then.
 */
export function isDueBetween(
	task: TaskTimes,
	start: number,
	end: number,
): boolean {
	if (task.status === "backlog" || task.dueAt === null) {
		return false;
	}
	const due = Date.parse(task.dueAt);
	const isOpenAtStart =
		task.completedAt === null
			? task.status !== "done"
			: Date.parse(task.completedAt) >= start;
	const existsAtStart = Date.parse(task.createdAt) <= start;
	return due >= start && due < end && isOpenAtStart && existsAtStart;
}

/** The time from start to done, in days with fractions. null for a task that is not done or never started. */
export function cycleTimeDays(
	task: Pick<TaskTimes, "startedAt" | "completedAt">,
): number | null {
	if (task.startedAt === null || task.completedAt === null) {
		return null;
	}
	return (Date.parse(task.completedAt) - Date.parse(task.startedAt)) / DAY_MS;
}
