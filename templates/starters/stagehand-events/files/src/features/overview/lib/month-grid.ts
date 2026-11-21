// Calendar helpers of the home: the first day of the week of a language, and the 6 x 7 days of a month view.
// EventCalendarCard draws the month with them. WeekdaySalesCard orders its bars with firstWeekday.
// Pure functions in the browser time zone. No calendar package.
import { z } from "zod";
import { addDays } from "~/features/organiser";

// Intl.Locale.getWeekInfo is new and the TS lib of the project does not type it. 7 is Sunday in its numbering.
const weekInfoSchema = z.object({ firstDay: z.number().int().min(1).max(7) });

/** The first day of the week in `locale`, as Date.getDay (0 is Sunday). Monday when the browser does not say. */
export function firstWeekday(locale: string): number {
	const intlLocale = new Intl.Locale(locale);
	if (
		"getWeekInfo" in intlLocale &&
		typeof intlLocale.getWeekInfo === "function"
	) {
		const parsed = weekInfoSchema.safeParse(intlLocale.getWeekInfo());
		if (parsed.success) {
			return parsed.data.firstDay % 7;
		}
	}
	return 1;
}

/** The 7 weekdays in the order of the week of `locale`, as Date.getDay values. */
export function weekdayOrder(locale: string): number[] {
	const first = firstWeekday(locale);
	return Array.from({ length: 7 }, (_, index) => (first + index) % 7);
}

/**
 * 42 local midnights (6 rows of 7) that hold the month of `monthStart`.
 * The first row starts on the first day of the week, so it can hold days of the previous month.
 */
export function monthGrid(monthStart: number, weekStart: number): number[] {
	const lead = (new Date(monthStart).getDay() - weekStart + 7) % 7;
	const gridStart = addDays(monthStart, -lead);
	return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

/** Local midnight of the first day of the month of `ms`, moved by `offset` months. */
export function monthStartOf(ms: number, offset = 0): number {
	const date = new Date(ms);
	return new Date(date.getFullYear(), date.getMonth() + offset, 1).getTime();
}
