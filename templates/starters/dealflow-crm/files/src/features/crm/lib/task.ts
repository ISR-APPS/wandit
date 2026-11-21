// The rules of a follow-up task: its due state from its due time, and its priority.
// The sample tables, the task lists, the follow-up tables, and the header alerts read this file,
// so every page counts the same overdue tasks.
import { calendarDaysFromNow } from "./relative-time";

/** Every due state, the most urgent first. The label is the message key `tasks.states.<state>`. */
export const TASK_DUE_STATES = ["overdue", "today", "upcoming"] as const;

/** One due state. */
export type TaskDueState = (typeof TASK_DUE_STATES)[number];

/**
 * The state of a task from its due time (ISO) and `now` (milliseconds since 1970).
 * It compares calendar days: a task due at 09:00 today stays "today" in the afternoon.
 */
export function taskDueState(dueAt: string, now: number): TaskDueState {
	const days = calendarDaysFromNow(dueAt, now);
	return days < 0 ? "overdue" : days === 0 ? "today" : "upcoming";
}

/** Every priority, the highest first. The label is the message key `tasks.priorities.<priority>`. */
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;

/** One priority. A later database keeps the same values in a check constraint of the tasks table. */
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
