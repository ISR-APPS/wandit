// Formats a time as "tomorrow", "in 3 days", or "2 hours ago" in the app language.
// The patient list and the detail pages use it for the last visit and the next appointment.
// A record date (a date of birth) uses an absolute Intl.DateTimeFormat date instead.
import { DAY_MS, MINUTE_MS, startOfLocalDay } from "./clinic-day";

const HOUR_MS = 60 * MINUTE_MS;

/**
 * `time` against `now`, both in milliseconds since 1970, in the browser time zone.
 * Days are calendar days: a time of 23:59 tomorrow reads "tomorrow" at any time today.
 */
export function formatRelativeTime(
	time: number,
	now: number,
	locale: string,
): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
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
		// From 9 weeks, months read better than "in 83 days". 30 days is the mean month for a label.
		if (Math.abs(days) >= 63) {
			return format.format(Math.round(days / 30), "month");
		}
		// From 2 weeks, weeks read better than "17 days ago".
		if (Math.abs(days) >= 14) {
			return format.format(Math.round(days / 7), "week");
		}
		return format.format(days, "day");
	}
	// The same calendar day: "in 5 hours" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}
