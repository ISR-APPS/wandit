// The rules of the tracker that more than one page applies: when a task is late, and what counts as committed work.
// The board, My tasks, the Team page, the project list, and the task dialog call them.
import type { TaskStatus } from "./codes";
import { DAY_MS } from "./time";

/** The task fields that the rules read. */
type TaskTimes = {
	status: TaskStatus;
	dueAt: string | null;
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
 * Committed work: the tasks that a person has picked up or will pick up next.
 * Backlog tasks are not committed, so they do not count against a capacity.
 */
export function isCommitted(status: TaskStatus): boolean {
	return (
		status === "todo" || status === "in-progress" || status === "in-review"
	);
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
