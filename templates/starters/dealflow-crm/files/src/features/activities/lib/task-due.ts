// The due state of a follow-up task: overdue, due today, or upcoming.
// The task list and the tabs of the follow-up card read it.
import { calendarDaysFromNow } from "~/features/crm";

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
