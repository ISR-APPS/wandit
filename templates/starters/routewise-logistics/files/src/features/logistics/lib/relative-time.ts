// Time helpers of the dispatch desk: the day length constants and the relative day label.
// The sample tables build their dates with the constants. The pages format due days with the label.
// A due date is a calendar day, so "late" does not change during a day.

/** One minute in milliseconds. The sample tables place the events of a day with it. */
export const MINUTE_MS = 60_000;

/** One hour in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;

/** One day in milliseconds. Day counts divide by it. */
export const DAY_MS = 24 * HOUR_MS;

/** Midnight at the start of the local day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/**
 * Calendar days from the day of `now` to the day of `timestamp` (ISO), in the browser time zone.
 * Negative for a past day. Math.round absorbs the 23-hour and 25-hour days of a clock change.
 */
export function calendarDaysFromNow(timestamp: string, now: number): number {
	return Math.round(
		(startOfLocalDay(Date.parse(timestamp)) - startOfLocalDay(now)) / DAY_MS,
	);
}

/** The day of `timestamp` against today: "today", "tomorrow", "2 days ago". Due dates use it. */
export function formatRelativeDay(
	timestamp: string,
	now: number,
	locale: string,
): string {
	return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
		calendarDaysFromNow(timestamp, now),
		"day",
	);
}
