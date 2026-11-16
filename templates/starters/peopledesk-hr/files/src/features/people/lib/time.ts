// Time units, calendar days, and relative time texts ("yesterday", "in 3 days") in the app language.
// The sample tables build every date with these helpers, as an offset in days from today.
// Lists and detail pages format operational times with formatRelativeTime. Record dates use Intl.DateTimeFormat.

/** One minute in milliseconds. */
export const MINUTE_MS = 60_000;

/** One hour in milliseconds. The sample tables place the events of a day with it. */
export const HOUR_MS = 60 * MINUTE_MS;

/** One day in milliseconds. Only for rough ages: calendar math uses setDate, which keeps clock changes right. */
export const DAY_MS = 24 * HOUR_MS;

/** Midnight at the start of the local day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/** The local midnight `offset` calendar days after `dayStart` (negative: before). setDate keeps clock changes right. */
export function shiftDays(dayStart: number, offset: number): Date {
	const date = new Date(dayStart);
	date.setDate(date.getDate() + offset);
	return date;
}

/** The local calendar day of `date` as YYYY-MM-DD. The sample rows store their days in this form. */
export function toDayKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** The local midnight of a YYYY-MM-DD key, in milliseconds since 1970. A text with no time is local in JavaScript. */
export function dayKeyToMs(day: string): number {
	return new Date(`${day}T00:00:00`).getTime();
}

/**
 * The date of a YYYY-MM-DD key for an axis tick or a tooltip.
 * It is midnight UTC: format it with `timeZone: "UTC"` to keep the same calendar day.
 */
export function dayKeyToUtcDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

/** Saturday or Sunday. The company works Monday to Friday, so time off counts only the other days. */
export function isWeekend(date: Date): boolean {
	const weekday = date.getDay();
	return weekday === 0 || weekday === 6;
}

/** Calendar days from the day of `now` to the day of `timestamp` (ISO or YYYY-MM-DD). Negative for a past day. */
export function calendarDaysFromNow(timestamp: string, now: number): number {
	const time =
		timestamp.length === 10 ? dayKeyToMs(timestamp) : Date.parse(timestamp);
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	return Math.round((startOfLocalDay(time) - startOfLocalDay(now)) / DAY_MS);
}

// Above 45 days a count of days ("347 days ago") is hard to read, so the text counts months.
// 46 days already rounds to "2 months", so the text never jumps from "45 days" back to "1 month".
const MONTH_THRESHOLD_DAYS = 45;
// The mean month length, for the rough month count of a relative text.
const DAYS_PER_MONTH = 30;

/**
 * `timestamp` (ISO) against `now` (milliseconds since 1970), in the browser time zone.
 * Days are calendar days: a request of 23:50 yesterday reads "yesterday" at any time today.
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
		// Under 45 seconds reads "now".
		return Math.abs(differenceMs) < 45_000
			? format.format(0, "second")
			: format.format(Math.round(differenceMs / MINUTE_MS), "minute");
	}
	const days = calendarDaysFromNow(timestamp, now);
	if (Math.abs(days) > MONTH_THRESHOLD_DAYS) {
		return format.format(Math.round(days / DAYS_PER_MONTH), "month");
	}
	if (days !== 0) {
		return format.format(days, "day");
	}
	// The same calendar day: "5 hours ago" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}

/** "today", "tomorrow", "in 4 days" for a YYYY-MM-DD day. Plans (a leave start, a last day) use it. */
export function formatRelativeDay(
	day: string,
	now: number,
	locale: string,
): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const days = calendarDaysFromNow(day, now);
	return Math.abs(days) > MONTH_THRESHOLD_DAYS
		? format.format(Math.round(days / DAYS_PER_MONTH), "month")
		: format.format(days, "day");
}
