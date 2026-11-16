// Month math of the calendar: month keys ("2026-11"), the day cells of a month grid, and month steps.
// CalendarPage and its grid call these pure functions. Weeks start on Monday, as in most agency planners.
import { dayKeyOf } from "~/features/marketing";

/** One cell of the month grid. */
export type MonthCell = {
	/** The local day as YYYY-MM-DD. */
	day: string;
	/** Local midnight of the day, in milliseconds since 1970. */
	startMs: number;
	/** False for the days of the previous or the next month that fill the first and the last week. */
	inMonth: boolean;
};

/** The month of `ms` as YYYY-MM, in the local time zone. */
export function monthKeyOf(ms: number): string {
	return dayKeyOf(ms).slice(0, 7);
}

/** Local midnight of the first day of a YYYY-MM key. */
export function monthStart(monthKey: string): number {
	const [year, month] = monthKey.split("-").map(Number);
	return new Date(year ?? 1970, (month ?? 1) - 1, 1).getTime();
}

/** The key of the month `delta` months after `monthKey`. A negative delta goes back. */
export function shiftMonth(monthKey: string, delta: number): string {
	const date = new Date(monthStart(monthKey));
	date.setMonth(date.getMonth() + delta);
	return monthKeyOf(date.getTime());
}

/** The cells of the grid of a month: whole weeks from the Monday on or before the 1st, 5 or 6 rows. */
export function monthCells(monthKey: string): MonthCell[] {
	const first = new Date(monthStart(monthKey));
	// getDay() is 0 on Sunday. Monday starts the week, so Sunday is 6 days after it.
	const lead = (first.getDay() + 6) % 7;
	const cursor = new Date(first);
	cursor.setDate(first.getDate() - lead);
	const cells: MonthCell[] = [];
	do {
		for (let weekday = 0; weekday < 7; weekday++) {
			const startMs = cursor.getTime();
			cells.push({
				day: dayKeyOf(startMs),
				startMs,
				inMonth: monthKeyOf(startMs) === monthKey,
			});
			cursor.setDate(cursor.getDate() + 1);
		}
	} while (monthKeyOf(cursor.getTime()) === monthKey);
	return cells;
}
