// Time helpers of the tracker: day lengths, the local day start, and relative time texts.
// The sample tables, the series functions, and the list pages call them.
// A record date (a creation date) uses an absolute Intl.DateTimeFormat date instead of a relative text.

/** One minute in milliseconds. */
export const MINUTE_MS = 60_000;

/** One hour in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;

/** One day in milliseconds. Ages and cycle times divide by it. */
export const DAY_MS = 24 * HOUR_MS;

/** Midnight at the start of the local day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/**
 * Calendar days from `now` to `timestamp` (ISO), in the browser time zone. Negative for a past day.
 * Math.round absorbs the 23-hour and 25-hour days of a clock change.
 */
export function calendarDaysFromNow(timestamp: string, now: number): number {
	return Math.round(
		(startOfLocalDay(Date.parse(timestamp)) - startOfLocalDay(now)) / DAY_MS,
	);
}

/**
 * `timestamp` (ISO) against `now` as "2 hours ago", "yesterday", or "in 3 days", in the app language.
 * Days are calendar days: a due time of 17:00 tomorrow reads "tomorrow" at any time today.
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
		return format.format(Math.round(differenceMs / MINUTE_MS), "minute");
	}
	const days = calendarDaysFromNow(timestamp, now);
	if (days !== 0) {
		return format.format(days, "day");
	}
	// The same calendar day: "in 5 hours" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}
