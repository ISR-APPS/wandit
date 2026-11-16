// Day and time helpers of the sample data, in the time zone of the browser.
// The sample modules build every date as "today plus N days", so the hotel never looks old.
// A day is a `YYYY-MM-DD` text. A time is an ISO text or milliseconds since 1970.

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

/** The local day of `ms` as `YYYY-MM-DD`. */
export function toIsoDay(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight of a `YYYY-MM-DD` day, in milliseconds since 1970. */
export function isoDayToMs(day: string): number {
	// A date-time text with no offset is local time in JavaScript.
	return new Date(`${day}T00:00:00`).getTime();
}

/** Whole calendar days from `fromDay` to `toDay`, both `YYYY-MM-DD`. Negative when `toDay` is earlier. */
export function daysBetween(fromDay: string, toDay: string): number {
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	return Math.round((isoDayToMs(toDay) - isoDayToMs(fromDay)) / DAY_MS);
}

/** Minutes from local midnight to `ms`, for example 615 at 10:15. */
export function minuteOfDay(ms: number): number {
	return Math.floor((ms - startOfLocalDay(ms)) / MINUTE_MS);
}
