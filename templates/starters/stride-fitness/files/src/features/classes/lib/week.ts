// The week of the class calendar: the Monday of a day, the 7 days of a week, and the weeks the sample covers.
// The classes page and the classes route call these pure functions. Times are local midnights in milliseconds.
import {
	AHEAD_DAYS,
	addDays,
	HISTORY_DAYS,
	startOfLocalDay,
	toDayKey,
} from "~/features/gym";

/** The days of a week. */
export const WEEK_LENGTH = 7;

/** The Monday of the week of `dayStart`. The gym timetable runs Monday to Sunday. */
export function weekStartOf(dayStart: number): number {
	// getDay() gives 0 for Sunday. The shift makes Monday 0 and Sunday 6.
	const daysSinceMonday = (new Date(dayStart).getDay() + 6) % WEEK_LENGTH;
	return addDays(dayStart, -daysSinceMonday);
}

/** The local midnights of the 7 days of the week that starts on `weekStart`. */
export function weekDays(weekStart: number): number[] {
	return Array.from({ length: WEEK_LENGTH }, (_, offset) =>
		addDays(weekStart, offset),
	);
}

/** The first and the last week that hold sessions: HISTORY_DAYS back and AHEAD_DAYS ahead of today. */
export function weekRange(todayStart: number): { first: number; last: number } {
	return {
		first: weekStartOf(addDays(todayStart, -HISTORY_DAYS)),
		last: weekStartOf(addDays(todayStart, AHEAD_DAYS)),
	};
}

/**
 * The Monday of the week to show, as `YYYY-MM-DD`. `dayKey` is the `day` search param, already a valid ISO day.
 * No day, or a day outside the sample weeks, gives the week of today.
 */
export function weekKeyFor(dayKey: string | undefined, now: number): string {
	const todayStart = startOfLocalDay(now);
	const fallback = weekStartOf(todayStart);
	if (dayKey === undefined) {
		return toDayKey(fallback);
	}
	const weekStart = weekStartOf(dayKeyToStart(dayKey));
	const range = weekRange(todayStart);
	return toDayKey(
		weekStart < range.first || weekStart > range.last ? fallback : weekStart,
	);
}

/** The local midnight of a valid `YYYY-MM-DD` key: a `day` search param, or a key of weekKeyFor. */
export function dayKeyToStart(dayKey: string): number {
	const [year = 0, month = 1, day = 1] = dayKey.split("-").map(Number);
	return new Date(year, month - 1, day).getTime();
}
