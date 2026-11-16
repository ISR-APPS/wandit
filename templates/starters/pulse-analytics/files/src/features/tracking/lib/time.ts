// Time helpers of the analytics pages: day lengths, local day starts, day keys, and relative times.
// The sample tables build every date with them. The pages format "2 hours ago" and axis dates with them.
// Every day is a calendar day in the browser time zone.

/** One minute in milliseconds. */
export const MINUTE_MS = 60_000;

/** One hour in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;

/** One day in milliseconds. Day differences divide by it. */
const DAY_MS = 24 * HOUR_MS;

/** Midnight at the start of the local day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/**
 * Midnight of the local day `daysAgo` days before the day that starts at `todayStart`.
 * setDate keeps the calendar day across a clock change. A subtraction of 24 hours does not.
 */
export function startOfDayAgo(todayStart: number, daysAgo: number): number {
	const date = new Date(todayStart);
	date.setDate(date.getDate() - daysAgo);
	return date.getTime();
}

/** The local calendar day of `ms` as YYYY-MM-DD: the `day` key of a chart point. */
export function dayKeyOf(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The date of a `day` key (YYYY-MM-DD), for an axis tick or a tooltip.
 * It is midnight UTC: format it with `timeZone: "UTC"` to keep the same calendar day.
 */
export function dayToDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

/**
 * Calendar days from `timestamp` (ISO) to `now`, in the browser time zone. 0 is today, 1 is yesterday.
 * Math.round absorbs the 23-hour and 25-hour days of a clock change.
 */
export function calendarDaysAgo(timestamp: string, now: number): number {
	return Math.round(
		(startOfLocalDay(now) - startOfLocalDay(Date.parse(timestamp))) / DAY_MS,
	);
}

/**
 * `timestamp` (ISO) against `now` (milliseconds since 1970), in the browser time zone.
 * Days are calendar days: 23:50 last evening reads "yesterday" at any time today.
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
	const days = -calendarDaysAgo(timestamp, now);
	if (days !== 0) {
		return format.format(days, "day");
	}
	// The same calendar day: "5 hours ago" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}
