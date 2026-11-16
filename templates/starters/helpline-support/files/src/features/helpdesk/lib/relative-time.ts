// Time helpers of the support desk: the units, the start of a day, relative times, and durations.
// The sample tables build their times with them. The pages format due times, ages, and reply times with them.
// A conversation entry of an earlier day shows its weekday and time. An old record date shows an absolute date.

/** One minute in milliseconds. */
export const MINUTE_MS = 60_000;

/** One hour in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;

/** One day in milliseconds. Day buckets and ages divide by it. */
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
 * Under 45 minutes it counts minutes. On the same day it counts hours. Else it counts calendar days.
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
 * The time of one conversation entry. Today it is relative: "2 hours ago".
 * An earlier day shows the time of day, "Thu 3:40 PM", so the reader sees the order and the waits.
 * From 7 days back, the date replaces the weekday: "Oct 2, 3:40 PM".
 */
export function formatEntryTime(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const days = calendarDaysFromNow(timestamp, now);
	if (days === 0) {
		return formatRelativeTime(timestamp, now, locale);
	}
	// A weekday is clear only inside the last week.
	const day: Intl.DateTimeFormatOptions =
		days > -7 ? { weekday: "short" } : { day: "numeric", month: "short" };
	return new Intl.DateTimeFormat(locale, {
		...day,
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(timestamp));
}

/**
 * The date of the last change of a record, such as a help article: "Aug 2".
 * Always a calendar date, so a column of dates reads in one format. The year shows only when it is not the current year.
 */
export function formatUpdateDate(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const date = new Date(timestamp);
	const isThisYear = date.getFullYear() === new Date(now).getFullYear();
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		year: isThisYear ? undefined : "numeric",
	}).format(date);
}

/**
 * A length of time in words: "42 min", "2 hr 36 min", "11 hr", "3 days".
 * Reply times, SLA targets, and late margins use it. `minutes` is never negative here.
 */
export function formatDuration(minutes: number, locale: string): string {
	const unitFormat = (unit: "minute" | "hour" | "day") =>
		new Intl.NumberFormat(locale, {
			style: "unit",
			unit,
			unitDisplay: unit === "day" ? "long" : "short",
			maximumFractionDigits: 0,
		});
	const rounded = Math.max(1, Math.round(minutes));
	if (rounded < 60) {
		return unitFormat("minute").format(rounded);
	}
	// Under 5 hours, the minutes still matter: "2 hr 36 min" reads better than "2.6 hr".
	if (rounded < 5 * 60) {
		const hours = Math.floor(rounded / 60);
		const rest = rounded % 60;
		const hourText = unitFormat("hour").format(hours);
		return rest === 0
			? hourText
			: `${hourText} ${unitFormat("minute").format(rest)}`;
	}
	// Up to two days, whole hours read better than "1.4 days".
	if (rounded < 48 * 60) {
		return unitFormat("hour").format(Math.round(rounded / 60));
	}
	return unitFormat("day").format(Math.round(rounded / (24 * 60)));
}
