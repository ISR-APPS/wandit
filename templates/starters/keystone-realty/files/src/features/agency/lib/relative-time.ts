// Formats a time as "tomorrow", "in 3 days", or "2 hours ago" in the app language.
// The lists and the detail pages use it for operational times: a viewing, the arrival of a lead.
// A record date (the first market day) uses an absolute Intl.DateTimeFormat date instead.
import { DAY_MS, HOUR_MS, MINUTE_MS, startOfLocalDay } from "./agency-clock";

/**
 * `timestamp` (ISO) against `now` (milliseconds since 1970), in the browser time zone.
 * Days are calendar days: a viewing at 18:00 tomorrow reads "tomorrow" at any time today.
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
	// The same calendar day: "in 5 hours" is more exact than "today".
	return format.format(Math.round(differenceMs / HOUR_MS), "hour");
}

/**
 * The time that passed since `timestamp`, as a length: "35 minutes", "5 hours", or "3 days".
 * With `unitDisplay` "narrow" it reads "35m", "5h", or "3d", for the badges of the narrow home rail.
 * The lead panel and the attention list use it. Days are calendar days, like formatRelativeTime.
 */
export function formatWaitingTime(
	timestamp: string,
	now: number,
	locale: string,
	unitDisplay: "long" | "narrow" = "long",
): string {
	const time = Date.parse(timestamp);
	const waitedMs = Math.max(0, now - time);
	// Calendar days, so "3 days" here and "3 days ago" in the leads table name the same day.
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	const calendarDays = Math.round(
		(startOfLocalDay(now) - startOfLocalDay(time)) / DAY_MS,
	);
	const [value, unit] =
		waitedMs < HOUR_MS
			? ([Math.max(1, Math.round(waitedMs / MINUTE_MS)), "minute"] as const)
			: // Under 2 days, hours say more than "1 day".
				waitedMs < 2 * DAY_MS
				? ([Math.round(waitedMs / HOUR_MS), "hour"] as const)
				: ([calendarDays, "day"] as const);
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit,
		unitDisplay,
	}).format(value);
}
