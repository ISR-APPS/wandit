// Month and week math of the calendar: month keys ("2026-11"), the day cells of a month or a week, and the steps.
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

/** Local midnight of a YYYY-MM-DD day key. */
export function dayStart(day: string): number {
	const [year, month, date] = day.split("-").map(Number);
	return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1).getTime();
}

/** The local midnight of the Monday on or before `ms`. */
function mondayOf(ms: number): Date {
	const monday = new Date(ms);
	monday.setHours(0, 0, 0, 0);
	// getDay() is 0 on Sunday. Monday starts the week, so Sunday is 6 days after it.
	monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
	return monday;
}

/** The seven cells of the week that holds `day` (YYYY-MM-DD), from Monday. Every cell counts as in the view. */
export function weekCells(day: string): MonthCell[] {
	const cursor = mondayOf(dayStart(day));
	const cells: MonthCell[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		const startMs = cursor.getTime();
		cells.push({ day: dayKeyOf(startMs), startMs, inMonth: true });
		cursor.setDate(cursor.getDate() + 1);
	}
	return cells;
}

/** The cells of the grid of a month: whole weeks from the Monday on or before the 1st, 5 or 6 rows. */
export function monthCells(monthKey: string): MonthCell[] {
	const cursor = mondayOf(monthStart(monthKey));
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
