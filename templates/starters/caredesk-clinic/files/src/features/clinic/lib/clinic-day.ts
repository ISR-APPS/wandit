// Day and time helpers of the sample data, in the time zone of the browser.
// The sample modules build every date as "today plus N days", so the practice never looks old.
// A day is a `YYYY-MM-DD` text. A time is an ISO text or milliseconds since 1970.

/** One minute, in milliseconds. */
export const MINUTE_MS = 60_000;
/** 24 hours, in milliseconds. A day with a clock change is 23 or 25 hours: use `addDays` for calendar days. */
export const DAY_MS = 24 * 60 * MINUTE_MS;

/** Midnight at the start of the local day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/** Local midnight `offset` calendar days after the local midnight `dayStart`. A negative offset goes back. */
export function addDays(dayStart: number, offset: number): number {
	const date = new Date(dayStart);
	// setDate moves the calendar day, so a clock change does not shift midnight.
	date.setDate(date.getDate() + offset);
	return date.getTime();
}

/** The local day of `ms` as `YYYY-MM-DD`. */
export function toIsoDay(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole calendar days from the local day of `fromMs` to the local day of `toMs`. Negative when `toMs` is earlier. */
export function daysBetween(fromMs: number, toMs: number): number {
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	return Math.round((startOfLocalDay(toMs) - startOfLocalDay(fromMs)) / DAY_MS);
}

/**
 * The local calendar date of `ms` as a count of days since 1 Jan 1970. The sample modules use it as a seed.
 * It reads the date, not the instant, so one date gives the same number in every time zone.
 */
export function epochDay(ms: number): number {
	const date = new Date(ms);
	return Math.round(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
	);
}

/** The time `minuteOfDay` minutes after the local midnight `dayStart`: 615 gives 10:15. */
export function atMinute(dayStart: number, minuteOfDay: number): number {
	const date = new Date(dayStart);
	// setHours keeps the wall-clock time on a day with a clock change.
	date.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
	return date.getTime();
}

/**
 * The start of the minute of `ms`. Every sample step falls on a whole minute, so a status is the same during that minute.
 * Each queryFn reads the clock through it: the minute of useNow(), so every page shows the same statuses and the same next patient.
 */
export function startOfMinute(ms: number): number {
	return Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}
