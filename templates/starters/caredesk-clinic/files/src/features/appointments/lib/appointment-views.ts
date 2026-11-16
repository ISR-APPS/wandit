// The view names of the appointments page, the period filter of its list, and the timeline of one appointment.
// The route validates its search with these names. The page, the list, and the detail panel call the functions.
import {
	type AppointmentRow,
	addDays,
	MINUTE_MS,
	NO_SHOW_AFTER_MINUTES,
	startOfLocalDay,
} from "~/features/clinic";

/** The two views of the page: the board of one day, or the list of the whole book. */
export const APPOINTMENT_VIEWS = ["day", "list"] as const;

/** One view. "day" is the view of a URL with no `view`. */
export type AppointmentView = (typeof APPOINTMENT_VIEWS)[number];

/** The period tabs of the list, in order. */
export const APPOINTMENT_PERIODS = ["today", "upcoming", "past"] as const;

/** One period tab. "upcoming" starts tomorrow. "past" ends yesterday. */
export type AppointmentPeriod = (typeof APPOINTMENT_PERIODS)[number];

/** The rows of one period. Upcoming rows come soonest first, past rows newest first. */
export function rowsOfPeriod(
	rows: readonly AppointmentRow[],
	period: AppointmentPeriod,
	now: number,
): AppointmentRow[] {
	const todayStart = startOfLocalDay(now);
	const tomorrowStart = addDays(todayStart, 1);
	if (period === "today") {
		return rows.filter(
			(row) => row.startsAt >= todayStart && row.startsAt < tomorrowStart,
		);
	}
	if (period === "upcoming") {
		return rows.filter((row) => row.startsAt >= tomorrowStart);
	}
	return rows.filter((row) => row.startsAt < todayStart).reverse();
}

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
