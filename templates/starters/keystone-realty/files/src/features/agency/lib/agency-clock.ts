// Day and time helpers of the sample data, in the time zone of the browser.
// The sample modules call them to place every row on a calendar day near today.
// A day number counts the calendar days since 1970. A time is milliseconds since 1970.

/** One minute, in milliseconds. */
export const MINUTE_MS = 60_000;
/** One hour, in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;
/** 24 hours, in milliseconds. A day with a clock change has 23 or 25 hours: use day numbers for calendar days. */
export const DAY_MS = 24 * HOUR_MS;

/** Midnight at the start of the local day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/** The day number of the local calendar day of `ms`. Two times of the same local day give the same number. */
export function dayNumberOf(ms: number): number {
	const date = new Date(ms);
	// Date.UTC of the local date parts is a whole count of days, in every time zone.
	return Math.round(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
	);
}

/** The local time `minuteOfDay` minutes after midnight on the day `dayNumber`, in milliseconds since 1970. */
export function timeOnDay(dayNumber: number, minuteOfDay: number): number {
	const day = new Date(dayNumber * DAY_MS);
	return new Date(
		day.getUTCFullYear(),
		day.getUTCMonth(),
		day.getUTCDate(),
		0,
		minuteOfDay,
	).getTime();
}

/** The weekday of a day number: 0 is Sunday, 6 is Saturday. */
export function weekdayOf(dayNumber: number): number {
	return new Date(dayNumber * DAY_MS).getUTCDay();
}

/** A day number as `YYYY-MM-DD`, the day format of the chart series. */
export function isoDayOf(dayNumber: number): string {
	return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/** The figures and the breakdowns of the app cover this count of whole days. Today is not one: it is not over. */
export const REPORT_DAYS = 30;

/** The start of the report period of `now`: midnight, 30 days before today. */
export function reportStartOf(now: number): number {
	return timeOnDay(dayNumberOf(now) - REPORT_DAYS, 0);
}

/** The end of the report period of `now`, excluded: midnight at the start of today. */
export function reportEndOf(now: number): number {
	return timeOnDay(dayNumberOf(now), 0);
}
