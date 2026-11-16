// Formats a time as "tomorrow", "in 3 days", or "2 hours ago" in the app language, and a day as "today".
// The member list and the member page use it for operational times: the last visit, the next class.
// A record date (a join date) uses an absolute Intl.DateTimeFormat date instead.
import { DAY_MS, MINUTE_MS, startOfLocalDay } from "./gym-time";

// 60 minutes, for the "in 5 hours" of a time later today.
const HOUR_MS = 60 * MINUTE_MS;

/**
 * `time` against `now`, both in milliseconds since 1970, in the browser time zone.
 * Days are calendar days: 23:59 tomorrow reads "tomorrow" at any time today.
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

/**
 * A calendar day against today: "today", "tomorrow", "in 3 days", "105 days ago".
 * For a date with no time, such as a payment day. `day` and `now` are milliseconds since 1970.
 */
export function formatRelativeDay(
	day: number,
	now: number,
	locale: string,
): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	const days = Math.round(
		(startOfLocalDay(day) - startOfLocalDay(now)) / DAY_MS,
	);
	return format.format(days, "day");
}
