// The state of each line of a run of show at a time: done, now, or next.
// RunOfShowCard reads it to mark the lines that passed and the line that runs now.
import { MINUTE_MS, type ScheduleItem } from "~/features/organiser";

/** The state of one line. "upcoming" is every line after the next one. */
export type ScheduleState = "done" | "now" | "next" | "upcoming";

/** One line with its state. */
export type ScheduleLine = ScheduleItem & { state: ScheduleState };

/** The lines in time order. Only the first line that has not started is "next". */
export function scheduleLines(
	items: ScheduleItem[],
	now: number,
): ScheduleLine[] {
	let hasNext = false;
	return [...items]
		.sort((first, second) => first.startsAt - second.startsAt)
		.map((item): ScheduleLine => {
			const endsAt = item.startsAt + item.durationMinutes * MINUTE_MS;
			if (endsAt <= now) {
				return { ...item, state: "done" };
			}
			if (item.startsAt <= now) {
				return { ...item, state: "now" };
			}
			const state: ScheduleState = hasNext ? "upcoming" : "next";
			hasNext = true;
			return { ...item, state };
		});
}
