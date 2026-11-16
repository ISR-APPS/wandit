// Time units and relative time texts: "yesterday", "3 days ago", "2 hours ago" in the app language.
// The sample tables build their dates with the units. Lists and detail pages format operational times with them.
// A record date (the day a customer joined) uses an absolute Intl.DateTimeFormat date instead.

/** One minute in milliseconds. The sample tables place the orders of a day with it. */
export const MINUTE_MS = 60_000;

/** One hour in milliseconds. The fulfilment delays of the sample orders use it. */
export const HOUR_MS = 60 * MINUTE_MS;

/** One day in milliseconds. Day buckets and order ages divide by it. */
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
 * Days are calendar days: an order of 23:50 yesterday reads "yesterday" at any time today.
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
	// The same calendar day: "5 hours ago" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}
