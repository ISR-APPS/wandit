// Day math and time labels in the browser time zone.
// sample-data.ts builds its dates with the day helpers. The pages format times with the label helpers.
// Operational times (a due day, the last movement) read as relative text. Records use absolute dates.

/** One minute in milliseconds. */
export const MINUTE_MS = 60_000;
/** One hour in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;
/** One day in milliseconds. A local day can have 23 or 25 hours at a clock change; round with it. */
export const DAY_MS = 24 * HOUR_MS;

/** Local midnight at the start of the day of `ms`, in milliseconds since 1970. */
export function startOfLocalDay(ms: number): number {
	return new Date(ms).setHours(0, 0, 0, 0);
}

/** Local midnight `days` calendar days after the day of `dayStart`. setDate keeps midnight across a clock change. */
export function addLocalDays(dayStart: number, days: number): number {
	const date = new Date(dayStart);
	date.setDate(date.getDate() + days);
	return date.setHours(0, 0, 0, 0);
}

/** Calendar days from the day of `fromMs` to the day of `toMs`. Positive when `toMs` is later. */
export function calendarDaysBetween(fromMs: number, toMs: number): number {
	// Math.round absorbs the 23-hour and 25-hour days of a clock change.
	return Math.round((startOfLocalDay(toMs) - startOfLocalDay(fromMs)) / DAY_MS);
}

/** The local day of `ms` as YYYY-MM-DD: the `day` format of the chart series. */
export function dayKeyOf(ms: number): string {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** The relative day of a calendar date, with no hour: "today", "tomorrow", "3 days ago". For due days and expected days. */
export function formatRelativeDay(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	return format.format(calendarDaysBetween(now, Date.parse(timestamp)), "day");
}

/** A past event as its relative day and its clock time, for example "yesterday, 14:05". Movement lists use it. */
export function formatEventTime(
	timestamp: string,
	now: number,
	locale: string,
): string {
	const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const time = Date.parse(timestamp);
	const days = calendarDaysBetween(now, time);
	// Past a week, a weekday name or "12 days ago" helps less than the date itself.
	if (days < -6) {
		return new Intl.DateTimeFormat(locale, {
			day: "numeric",
			month: "short",
			hour: "numeric",
			minute: "2-digit",
		}).format(time);
	}
	const day = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
		days,
		"day",
	);
	return `${day}, ${clock.format(time)}`;
}
