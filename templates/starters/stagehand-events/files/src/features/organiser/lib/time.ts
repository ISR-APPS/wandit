// Day and time helpers of the sample data, in the time zone of the browser.
// The sample modules build every date as "today plus N days", so the calendar never looks old.
// A day is a `YYYY-MM-DD` text. A time is milliseconds since 1970.

/** One minute, in milliseconds. */
export const MINUTE_MS = 60_000;
/** One hour, in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;
/** 24 hours, in milliseconds. A day with a clock change is 23 or 25 hours: use `addDays` for calendar days. */
export const DAY_MS = 24 * HOUR_MS;

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

/** The local time `minutes` after the midnight of `dayStart`, for example 1170 for 19:30. */
export function atMinute(dayStart: number, minutes: number): number {
	const date = new Date(dayStart);
	// setHours with a minute count above 59 rolls over, and it keeps local time on a clock-change day.
	date.setHours(0, minutes, 0, 0);
	return date.getTime();
}

/** The local day of `ms` as `YYYY-MM-DD`. */
export function toIsoDay(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole calendar days from the day of `fromMs` to the day of `toMs`. Negative when `toMs` is earlier. */
export function calendarDaysBetween(fromMs: number, toMs: number): number {
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	return Math.round((startOfLocalDay(toMs) - startOfLocalDay(fromMs)) / DAY_MS);
}
