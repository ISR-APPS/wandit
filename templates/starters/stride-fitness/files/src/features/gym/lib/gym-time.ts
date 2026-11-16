// Day and time helpers of the gym, in the time zone of the browser.
// The sample modules build every date as "today plus N days", so the gym never looks old.
// A time is milliseconds since 1970. A day key is a `YYYY-MM-DD` text.

/** One minute, in milliseconds. */
export const MINUTE_MS = 60_000;
/** 24 hours, in milliseconds. A day with a clock change is 23 or 25 hours: use `addDays` for calendar days. */
export const DAY_MS = 24 * 60 * MINUTE_MS;

/** Midnight at the start of the local day of `ms`. */
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

/** The time `minuteOfDay` minutes after the local midnight `dayStart`: 390 gives 06:30. */
export function atMinute(dayStart: number, minuteOfDay: number): number {
	const date = new Date(dayStart);
	// setHours keeps the wall-clock time on a day with a clock change.
	date.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
	return date.getTime();
}

/** The local day of `ms` as `YYYY-MM-DD`. The chart rows and the session ids use it. */
export function toDayKey(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
