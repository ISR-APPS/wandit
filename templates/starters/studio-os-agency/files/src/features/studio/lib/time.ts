// Calendar-day helpers of Studio OS. Every date of the sample data is a local day as "YYYY-MM-DD".
// The sample generator, the series functions, and the pages call them.
// Days count from the local midnight of today, so the rows stay the same for the whole day.

/** One day in milliseconds. Only the clock-change rounding below divides by it. */
const DAY_MS = 86_400_000;

/** A local calendar day as "YYYY-MM-DD". Midnight in the browser time zone. */
export type Day = string;

/** The "YYYY-MM-DD" text of a local date. */
export function toDay(date: Date): Day {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight of a "YYYY-MM-DD" day. A date-time text with no offset is local time in JavaScript. */
export function parseDay(day: Day): Date {
	return new Date(`${day}T00:00:00`);
}

/** The day `offset` calendar days from today: 0 is today, -1 is yesterday, 7 is in a week. */
export function dayFromToday(offset: number): Day {
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	// setDate keeps local midnight across a clock change; adding milliseconds would not.
	date.setDate(date.getDate() + offset);
	return toDay(date);
}

/** The day `offset` calendar days after `day`. */
export function addDays(day: Day, offset: number): Day {
	const date = parseDay(day);
	date.setDate(date.getDate() + offset);
	return toDay(date);
}

/** Calendar days from `from` to `to`. Math.round absorbs the 23-hour and 25-hour days of a clock change. */
export function daysBetween(from: Day, to: Day): number {
	return Math.round(
		(parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS,
	);
}

/** Calendar days from today to `day`. Negative for a past day. */
export function daysFromToday(day: Day): number {
	return daysBetween(dayFromToday(0), day);
}

/** True on Saturday and Sunday. The studio logs few hours then. */
export function isWeekend(day: Day): boolean {
	const weekday = parseDay(day).getDay();
	return weekday === 0 || weekday === 6;
}

/** "yesterday", "in 3 days", or "today" in the app language, by calendar days. */
export function formatRelativeDay(day: Day, locale: string): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	return format.format(daysFromToday(day), "day");
}
