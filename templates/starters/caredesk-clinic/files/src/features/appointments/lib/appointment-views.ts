// The view names of the appointments calendar, and the timeline of one appointment.
// The route validates its search with the view names. The detail panel calls buildTimeline.
import {
	type AppointmentRow,
	MINUTE_MS,
	NO_SHOW_AFTER_MINUTES,
} from "~/features/clinic";

/** The two views of the calendar: a month of 6 weeks, or one week with every appointment. */
export const CALENDAR_VIEWS = ["month", "week"] as const;

/** One view. "month" is the view of a URL with no `view`. */
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** The steps of a visit that the detail panel can show. The label is the message key `timeline.<step>`. */
export type TimelineStep =
	| "booked"
	| "confirmed"
	| "cancelled"
	| "checkedIn"
	| "started"
	| "ended"
	| "noShow";

/** One step that happened, with its time in milliseconds since 1970. */
export type TimelineEvent = { step: TimelineStep; at: number };

/** The steps of one appointment that are in the past, oldest first. A step that did not happen yet is absent. */
export function buildTimeline(row: AppointmentRow): TimelineEvent[] {
	const steps: { step: TimelineStep; at: number | null }[] = [
		{ step: "booked", at: row.bookedAt },
		{ step: "confirmed", at: row.confirmedAt },
		{ step: "cancelled", at: row.cancelledAt },
		{ step: "checkedIn", at: row.checkedInAt },
		{ step: "started", at: row.startedAt },
		{ step: "ended", at: row.endedAt },
		{
			step: "noShow",
			at:
				row.status === "no_show"
					? row.startsAt + NO_SHOW_AFTER_MINUTES * MINUTE_MS
					: null,
		},
	];
	return steps
		.flatMap(({ step, at }) => (at === null ? [] : [{ step, at }]))
		.sort((first, second) => first.at - second.at);
}
