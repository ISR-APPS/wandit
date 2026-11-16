// Formats a time as "tomorrow", "in 3 days", or "2 hours ago" in the app language.
// The home list, the event pages, and the guest list use it for operational times.
// A record date (an order date in a detail panel) uses an absolute Intl.DateTimeFormat date instead.
import { DAY_MS, HOUR_MS, MINUTE_MS, startOfLocalDay } from "./time";

/**
 * `time` (milliseconds since 1970) against `now`, in the browser time zone.
 * Days are calendar days: a show at 20:00 tomorrow reads "tomorrow" at any time today.
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
		return format.format(days, "day");
	}
	// The same calendar day: "in 5 hours" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}
