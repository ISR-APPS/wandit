// The priority of an open deliverable, from the days left before its due day.
// The reminders of the home, the task board of a project, and its table read it.
import { type Day, daysFromToday } from "./time";

/** The priorities, the most urgent first. The label is `codes.priorities.<priority>`. */
export const PRIORITIES = ["high", "medium", "low"] as const;

/** One priority. */
export type Priority = (typeof PRIORITIES)[number];

// Due today, tomorrow, or late: the owner must act now. A week or less: plan it this week.
const HIGH_PRIORITY_DAYS = 1;
const MEDIUM_PRIORITY_DAYS = 7;

/** "high" for a deliverable due today, tomorrow, or late, "medium" up to 7 days, else "low". */
export function priorityOf(dueDay: Day): Priority {
	const daysLeft = daysFromToday(dueDay);
	if (daysLeft <= HIGH_PRIORITY_DAYS) {
		return "high";
	}
	return daysLeft <= MEDIUM_PRIORITY_DAYS ? "medium" : "low";
}

/** The dot color of each priority. The word always shows next to the dot. */
export const PRIORITY_DOT = {
	high: "bg-destructive",
	medium: "bg-warning",
	low: "bg-muted-foreground",
} satisfies Record<Priority, string>;
