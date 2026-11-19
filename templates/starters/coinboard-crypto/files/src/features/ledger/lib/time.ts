// Time helpers of the app: the length of a day, the start of the local day, and relative times.
// The sample data, the series functions, and the pages of every feature use them.
// A record date (a transaction time in a detail panel) uses an absolute Intl.DateTimeFormat date instead.

/** Milliseconds in one minute. */
export const MINUTE_MS = 60_000;
/** Milliseconds in one hour. */
export const HOUR_MS = 60 * MINUTE_MS;
/** Milliseconds in one day of 24 hours. */
export const DAY_MS = 24 * HOUR_MS;

/** Midnight at the start of the local day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/**
 * `timestamp` (ISO) against `now` (milliseconds since 1970), in the browser time zone: "yesterday", "3 days ago".
 * Days are calendar days: a time of 23:59 yesterday reads "yesterday" at any time today.
 */
export function formatRelativeTime(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const time = Date.parse(timestamp);
	const differenceMs = time - now;
	// Under 45 minutes, minutes are exact. Just after midnight, "yesterday" would hide "20 minutes ago".
	if (Math.abs(differenceMs) < 45 * MINUTE_MS) {
		// Under 45 seconds reads "now".
		return Math.abs(differenceMs) < 45_000
			? format.format(0, "second")
			: format.format(Math.round(differenceMs / MINUTE_MS), "minute");
	}
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	const days = Math.round(
		(startOfLocalDay(time) - startOfLocalDay(now)) / DAY_MS,
	);
	if (days !== 0) {
		return format.format(days, "day");
	}
	// The same calendar day: "5 hours ago" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}
