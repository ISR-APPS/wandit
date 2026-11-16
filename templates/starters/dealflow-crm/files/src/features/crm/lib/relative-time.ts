// Formats a time as "tomorrow", "in 3 days", or "2 hours ago" in the app language.
// List pages and detail pages use it for operational times: a due time, the last activity.
// A record date (a creation date) uses an absolute Intl.DateTimeFormat date instead.

/** One minute in milliseconds. The sample tables place the activities of a day with it. */
export const MINUTE_MS = 60_000;

/** One hour in milliseconds. The sample tables build the times of a day with it. */
export const HOUR_MS = 60 * MINUTE_MS;

/** One day in milliseconds. Ages and day buckets divide by it. */
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
 * `timestamp` (ISO) against `now` (milliseconds since 1970), in the browser time zone.
 * Days are calendar days: a due time of 23:59 tomorrow reads "tomorrow" at any time today.
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
	if (days !== 0) {
		return format.format(days, "day");
	}
	// The same calendar day: "in 5 hours" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}

/**
 * The time since `timestamp` (ISO) as a short age: "6d" for calendar days, "5h" inside the first day.
 * The board slips show it as the age of a deal in its stage.
 */
export function formatAge(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const days = -calendarDaysFromNow(timestamp, now);
	const unit = days > 0 ? "day" : "hour";
	// Inside the first day the age is in hours, and at least 1: "0h" reads as an error.
	const value =
		days > 0
			? days
			: Math.max(1, Math.round((now - Date.parse(timestamp)) / HOUR_MS));
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit,
		unitDisplay: "narrow",
	}).format(value);
}
