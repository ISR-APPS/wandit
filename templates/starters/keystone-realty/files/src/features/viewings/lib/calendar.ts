// Calendar math of the viewings: the weeks of a month grid, the 7 days of a week, and the viewings per day.
// The calendar page and the calendar card of the home call these pure functions. No calendar package.
// A day is a day number: the count of local calendar days since 1970 (agency-clock.ts).
import {
	DAY_MS,
	dayNumberOf,
	type ViewingRow,
	weekdayOf,
} from "~/features/agency";

/** Days in a week: the columns of every calendar grid. */
export const WEEK_DAYS = 7;

/** One cell of a month grid. */
export type CalendarDay = {
	dayNumber: number;
	/** False for the days of the month before and the month after, which fill the first and the last row. */
	isInMonth: boolean;
};

// Intl.Locale gets getWeekInfo in newer engines only, and the ES2022 lib of TypeScript does not declare it.
type LocaleWithWeekInfo = Intl.Locale & {
	getWeekInfo?: () => { firstDay: number };
};

/** The first weekday of `locale`: 0 is Sunday, 1 is Monday. Monday when the browser does not know. */
export function weekStartOf(locale: string): number {
	const intlLocale: LocaleWithWeekInfo = new Intl.Locale(locale);
	// Intl counts 1 (Monday) to 7 (Sunday). The modulo turns 7 into 0, the Sunday of Date.getDay.
	return (intlLocale.getWeekInfo?.().firstDay ?? 1) % WEEK_DAYS;
}

/** The first day of the local calendar month that holds `dayNumber`. */
export function monthStartOf(dayNumber: number): number {
	const date = new Date(dayNumber * DAY_MS);
	return dayNumberOf(
		new Date(date.getUTCFullYear(), date.getUTCMonth(), 1).getTime(),
	);
}

/** The first day of the month `count` months after the month of `dayNumber`. A negative count goes back. */
export function addMonths(dayNumber: number, count: number): number {
	const date = new Date(dayNumber * DAY_MS);
	return dayNumberOf(
		new Date(date.getUTCFullYear(), date.getUTCMonth() + count, 1).getTime(),
	);
}

/** The first day of the week that holds `dayNumber`. */
export function weekStartDayOf(dayNumber: number, weekStart: number): number {
	return (
		dayNumber - ((weekdayOf(dayNumber) - weekStart + WEEK_DAYS) % WEEK_DAYS)
	);
}

/**
 * The first day of the grid of the month that holds `dayNumber`, and the day after its last cell.
 * The grid holds only the weeks that the month touches: 4 to 6 rows.
 */
export function monthGridRange(
	dayNumber: number,
	weekStart: number,
): [number, number] {
	const first = monthStartOf(dayNumber);
	const lastWeekStart = weekStartDayOf(addMonths(first, 1) - 1, weekStart);
	return [weekStartDayOf(first, weekStart), lastWeekStart + WEEK_DAYS];
}

/** The days of the grid of the month that holds `dayNumber`, from the first day of its first week. */
export function buildMonthGrid(
	dayNumber: number,
	weekStart: number,
): CalendarDay[] {
	const first = monthStartOf(dayNumber);
	const next = addMonths(first, 1);
	const [gridStart, gridEnd] = monthGridRange(dayNumber, weekStart);
	return Array.from({ length: gridEnd - gridStart }, (_, index) => {
		const day = gridStart + index;
		return { dayNumber: day, isInMonth: day >= first && day < next };
	});
}

/** The viewings of each day, by start time. Cancelled viewings stay: the calendar strikes them through. */
export function viewingsByDay(
	viewings: ViewingRow[],
): Map<number, ViewingRow[]> {
	const days = new Map<number, ViewingRow[]>();
	for (const viewing of viewings) {
		const day = dayNumberOf(Date.parse(viewing.startsAt));
		days.set(day, [...(days.get(day) ?? []), viewing]);
	}
	return days;
}

/** A day number as a local Date at midnight, for Intl.DateTimeFormat. */
export function dateOfDay(dayNumber: number): Date {
	const date = new Date(dayNumber * DAY_MS);
	return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
