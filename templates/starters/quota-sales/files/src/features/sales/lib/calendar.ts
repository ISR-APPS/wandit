// Day numbers and sales quarters. Every page counts days and quarters with these functions.
// A day number is the count of calendar days since 1970-01-01 for the local date. It has no time and no zone.
// sample-data.ts, the query files, and the chart labels read it. Plain math, no dependency.

/** Milliseconds in one minute. */
export const MINUTE_MS = 60_000;
/** Milliseconds in one hour. */
export const HOUR_MS = 60 * MINUTE_MS;
/** Milliseconds in one calendar day of UTC. The day numbers use UTC, so no clock change applies. */
export const DAY_MS = 24 * HOUR_MS;

/** The day number of the local calendar date of `date`. The same date in every time zone gives the same number. */
export function dayNumberOf(date: Date): number {
	return Math.round(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
	);
}

/** The day number of today in the browser time zone. */
export function todayDayNumber(): number {
	return dayNumberOf(new Date());
}

/** A Date at midnight UTC of a day number. Format it with `timeZone: "UTC"` to show its calendar date. */
export function utcDateOf(dayNumber: number): Date {
	return new Date(dayNumber * DAY_MS);
}

/** The local Date of a day number plus `minutes` after local midnight. Booking times use it. */
export function localDateTimeOf(dayNumber: number, minutes: number): Date {
	const utc = utcDateOf(dayNumber);
	return new Date(
		utc.getUTCFullYear(),
		utc.getUTCMonth(),
		utc.getUTCDate(),
		0,
		minutes,
	);
}

/** The day as YYYY-MM-DD. The chart points use it as their key. */
export function dayKeyOf(dayNumber: number): string {
	return utcDateOf(dayNumber).toISOString().slice(0, 10);
}

/** 0 is Sunday and 6 is Saturday, as `Date.getDay()`. */
export function weekdayOf(dayNumber: number): number {
	return utcDateOf(dayNumber).getUTCDay();
}

/** The count of weekdays from `fromDay` up to `toDay` (excluded). Targets count only these days: a weekend day books about a quarter of a weekday. */
export function sellingDaysBetween(fromDay: number, toDay: number): number {
	let count = 0;
	for (let day = fromDay; day < toDay; day += 1) {
		const weekday = weekdayOf(day);
		if (weekday !== 0 && weekday !== 6) {
			count += 1;
		}
	}
	return count;
}

/** One calendar quarter. The team plans its targets per quarter. */
export type Quarter = {
	year: number;
	/** 1 to 4. */
	quarter: number;
	/** The day number of the first day. */
	startDay: number;
	/** The day number of the first day of the next quarter. */
	endDay: number;
};

/** The calendar quarter that holds a day. */
export function quarterOfDay(dayNumber: number): Quarter {
	const date = utcDateOf(dayNumber);
	const year = date.getUTCFullYear();
	const quarterIndex = Math.floor(date.getUTCMonth() / 3);
	return quarterFromIndex(year * 4 + quarterIndex);
}

/** The quarter `by` quarters after `quarter`. A negative `by` goes back. */
export function shiftQuarter(quarter: Quarter, by: number): Quarter {
	return quarterFromIndex(quarter.year * 4 + quarter.quarter - 1 + by);
}

// An index counts quarters since year 0: year * 4 + (quarter - 1).
function quarterFromIndex(index: number): Quarter {
	const year = Math.floor(index / 4);
	const quarterIndex = index - year * 4;
	const startDay = Math.round(Date.UTC(year, quarterIndex * 3, 1) / DAY_MS);
	const endDay = Math.round(Date.UTC(year, quarterIndex * 3 + 3, 1) / DAY_MS);
	return { year, quarter: quarterIndex + 1, startDay, endDay };
}

/** The progress of a quarter on `today`. The bookings count up to yesterday, so today is not elapsed yet. */
export type QuarterProgress = {
	/** Full days of the quarter before today. 0 on the first day, the full length after the end. */
	elapsedDays: number;
	/** Days in the quarter, 90 to 92. */
	totalDays: number;
	/** elapsedDays / totalDays: the share of the target that a linear pace expects by now. */
	pace: number;
};

/** The progress of `quarter` on the day `today`. */
export function quarterProgressOf(
	quarter: Quarter,
	today: number,
): QuarterProgress {
	const totalDays = quarter.endDay - quarter.startDay;
	const elapsedDays = Math.min(
		Math.max(today - quarter.startDay, 0),
		totalDays,
	);
	return { elapsedDays, totalDays, pace: elapsedDays / totalDays };
}

/** "Q4 2026". The quarter label is a code of the trade, the same in every language of the app. */
export function quarterLabelOf(quarter: Quarter): string {
	return `Q${quarter.quarter} ${quarter.year}`;
}
