// Day helpers of the sample ledger. A day is a `YYYY-MM-DD` text of the calendar of the browser.
// The sample modules build every date as "today minus N days" with them, so the ledger never looks old.
// The day math runs in UTC, so a clock change never moves a day.

/** 24 hours, in milliseconds. Only UTC day math uses it. */
const DAY_MS = 86_400_000;

/** The parts of one calendar day. `month` is 1 to 12. `weekday` is 0 for Sunday to 6 for Saturday. */
export type DayParts = {
	year: number;
	month: number;
	dayOfMonth: number;
	weekday: number;
};

// Midnight UTC of a `YYYY-MM-DD` day, in milliseconds since 1970.
function utcMsOf(day: string): number {
	return Date.parse(`${day}T00:00:00Z`);
}

// The `YYYY-MM-DD` text of a UTC midnight.
function isoDayOfUtc(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** The local calendar day of `ms` (milliseconds since 1970) as `YYYY-MM-DD`. */
export function toIsoDay(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** The day `offset` calendar days after `day`. A negative offset goes back. */
export function addDays(day: string, offset: number): string {
	return isoDayOfUtc(utcMsOf(day) + offset * DAY_MS);
}

/** Whole calendar days from `fromDay` to `toDay`. Negative when `toDay` is earlier. */
export function daysBetween(fromDay: string, toDay: string): number {
	return Math.round((utcMsOf(toDay) - utcMsOf(fromDay)) / DAY_MS);
}

/** Count of days since 1970-01-01. The sample generator uses it as the seed of one day. */
export function dayNumberOf(day: string): number {
	return Math.round(utcMsOf(day) / DAY_MS);
}

/** The year, the month, the day of the month, and the weekday of `day`. */
export function dayPartsOf(day: string): DayParts {
	const date = new Date(utcMsOf(day));
	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		dayOfMonth: date.getUTCDate(),
		weekday: date.getUTCDay(),
	};
}

/** The `YYYY-MM-DD` text of a year, a month (1 to 12), and a day of the month. Day 0 is the last day of the month before. */
export function isoDayOf(
	year: number,
	month: number,
	dayOfMonth: number,
): string {
	return isoDayOfUtc(Date.UTC(year, month - 1, dayOfMonth));
}

/** The first day of the month of `day`. */
export function monthStartOf(day: string): string {
	return `${day.slice(0, 7)}-01`;
}

/** The first day of the month `offset` months after the month of `day`. -1 gives the month before. */
export function addMonths(day: string, offset: number): string {
	const { year, month } = dayPartsOf(day);
	return isoDayOf(year, month + offset, 1);
}

/** The last day of the month of `day`. */
export function monthEndOf(day: string): string {
	return addDays(addMonths(day, 1), -1);
}

/** The last `count` days that end on `lastDay`, oldest first. */
export function lastDays(lastDay: string, count: number): string[] {
	return Array.from({ length: count }, (_, index) =>
		addDays(lastDay, index - count + 1),
	);
}

/** A `YYYY-MM-DD` day as a Date at midnight UTC. Format it with `timeZone: "UTC"` to keep the calendar day. */
export function dayToDate(day: string): Date {
	return new Date(utcMsOf(day));
}
