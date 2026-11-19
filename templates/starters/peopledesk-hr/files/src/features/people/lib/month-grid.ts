// The days of a month view and of a week view: 4 to 6 rows of 7 days, or one row of 7 days.
// The calendar card of the home and the leave calendar of the time-off page call it. It reads no data.
// The first day of the week follows the locale: Monday in most of Europe, Sunday in the United States.
import { shiftDays, startOfLocalDay } from "./time";

// Intl.Locale.getWeekInfo is new. The TypeScript lib does not type it yet in every target.
type LocaleWithWeekInfo = Intl.Locale & {
	getWeekInfo?: () => { firstDay: number };
};

/** The first day of the week of `locale`, as Date.getDay() counts it: 0 is Sunday, 1 is Monday. */
export function firstDayOfWeek(locale: string): number {
	// SAFETY: the extra field is optional, and the call below checks that it exists.
	const info = (new Intl.Locale(locale) as LocaleWithWeekInfo).getWeekInfo?.();
	// getWeekInfo counts Sunday as 7. Without it, Monday is the ISO default.
	return info ? info.firstDay % 7 : 1;
}

/** Local midnight of the first day of the week that holds `ms`. */
export function startOfWeek(ms: number, locale: string): number {
	const dayStart = startOfLocalDay(ms);
	const back = (new Date(dayStart).getDay() - firstDayOfWeek(locale) + 7) % 7;
	return shiftDays(dayStart, -back).getTime();
}

/** Local midnight of the first day of the month `offset` months after the month of `ms`. 0 gives its own month. */
export function addMonths(ms: number, offset: number): number {
	const date = new Date(ms);
	return new Date(date.getFullYear(), date.getMonth() + offset, 1).getTime();
}

/** The days of the month view of `monthStart`, local midnights: full weeks from the week of the 1st to the week of the last day. */
export function monthGridDays(monthStart: number, locale: string): number[] {
	const first = startOfWeek(monthStart, locale);
	const date = new Date(monthStart);
	// Day 0 of the next month is the last day of this month.
	const daysInMonth = new Date(
		date.getFullYear(),
		date.getMonth() + 1,
		0,
	).getDate();
	const leadingDays = (date.getDay() - firstDayOfWeek(locale) + 7) % 7;
	// Only the weeks that hold a day of the month, as the kit month view shows them.
	const weeks = Math.ceil((leadingDays + daysInMonth) / 7);
	return Array.from({ length: weeks * 7 }, (_, index) =>
		shiftDays(first, index).getTime(),
	);
}

/** The 7 days of the week that holds `ms`, local midnights. */
export function weekDays(ms: number, locale: string): number[] {
	const first = startOfWeek(ms, locale);
	return Array.from({ length: 7 }, (_, index) =>
		shiftDays(first, index).getTime(),
	);
}
