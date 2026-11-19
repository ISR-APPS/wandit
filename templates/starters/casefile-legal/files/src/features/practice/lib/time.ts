// Time helpers of the practice: local days, day keys, and relative times.
// The sample tables build their dates with them. The pages format deadlines and entry days with them.
// Every function takes "now" as an argument, so a render reads the clock once.

/** One hour in milliseconds. */
export const HOUR_MS = 3_600_000;
/** One day in milliseconds. Use addLocalDays to move by calendar days across a clock change. */
export const DAY_MS = 24 * HOUR_MS;
const MINUTE_MS = 60_000;

/** Midnight at the start of the local day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/** `ms` moved by `days` calendar days in the browser time zone. A clock change keeps the local hour. */
export function addLocalDays(ms: number, days: number): number {
	const date = new Date(ms);
	date.setDate(date.getDate() + days);
	return date.getTime();
}

/** The local day of `ms` as YYYY-MM-DD. Time entries and chart points use this key. */
export function dayKeyOf(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * A YYYY-MM-DD key as a Date at midnight UTC.
 * Format it with `timeZone: "UTC"`, so the calendar day stays the same in every time zone.
 */
export function dayToDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

/** Whole calendar days from the local day of `now` to the local day of `timestamp`. Negative in the past. */
export function calendarDaysUntil(timestamp: string, now: number): number {
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	return Math.round(
		(startOfLocalDay(Date.parse(timestamp)) - startOfLocalDay(now)) / DAY_MS,
	);
}

/**
 * `timestamp` (ISO) against `now`, as "tomorrow", "in 3 days", or "2 hours ago" in the app language.
 * Days are calendar days: a deadline at 23:59 tomorrow reads "tomorrow" at any time today.
 */
export function formatRelativeTime(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const differenceMs = Date.parse(timestamp) - now;
	// Under 45 minutes, minutes are exact. Just after midnight, "yesterday" would hide "20 minutes ago".
	if (Math.abs(differenceMs) < 45 * MINUTE_MS) {
		return Math.abs(differenceMs) < 45_000
			? format.format(0, "second")
			: format.format(Math.round(differenceMs / MINUTE_MS), "minute");
	}
	const days = calendarDaysUntil(timestamp, now);
	if (days !== 0) {
		return format.format(days, "day");
	}
	// The same calendar day: "in 5 hours" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}
