// The priority of a deadline from the calendar days that remain before it.
// The deadline cards of the dashboard and of the matter page, and the header alerts read it,
// so every page gives one deadline the same priority.
import { DEADLINE_SOON_DAYS } from "./matter-stage";
import { calendarDaysUntil } from "./time";

/** Every priority, the highest first. The label is the message key `priorities.<priority>`. */
export const DEADLINE_PRIORITIES = ["high", "medium", "low"] as const;

/** One priority. */
export type DeadlinePriority = (typeof DEADLINE_PRIORITIES)[number];

/**
 * A deadline in 3 calendar days or less is "high": a filing needs its final review now.
 * Up to DEADLINE_SOON_DAYS (7) it is "medium". Later deadlines are "low".
 */
export function deadlinePriority(dueAt: string, now: number): DeadlinePriority {
	const days = calendarDaysUntil(dueAt, now);
	return days <= 3 ? "high" : days <= DEADLINE_SOON_DAYS ? "medium" : "low";
}
