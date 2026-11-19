// Shapes of the chart data, and the pure functions that cut a period out of a day table.
// The query files build the series and the totals with these functions. The chart cards take the types.
// A day table is a list of numbers with one entry per day: the index is "days ago", and index 1 is yesterday.
import { dayKeyOf, startOfDayAgo } from "./time";

/** The period choices of the pages, in complete days. The sample tables hold two periods of the longest one. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The period of the first load of each page. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** The place of a period in PERIOD_DAYS. The sample tables keep one total per period at this index. */
export function periodIndexOf(days: PeriodDays): number {
	return PERIOD_DAYS.indexOf(days);
}

/** One day of a trend, oldest first in a list. Zero on a day with no event. */
export type DailyPoint = {
	/** YYYY-MM-DD in the browser time zone. */
	day: string;
	/** The total of that day. */
	current: number;
	/** The total of the same day one period earlier. */
	previous: number;
};

/** A total of the period and the total of the period of the same length just before. */
export type PeriodTotals = { current: number; previous: number };

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** A share from 0 to 1. A total of 0 gives 0, so an empty period draws an empty bar. */
export function shareOf(part: number, total: number): number {
	return total === 0 ? 0 : part / total;
}

/**
 * The share of each part of a whole, in whole percents that add up to 100 % (largest remainder method).
 * A list that shows each part with "42%" uses it, so its shares never add up to 99 % or 101 %.
 * A total of 0 gives 0 for each part.
 */
export function wholeShares(parts: number[]): number[] {
	const total = parts.reduce((sum, part) => sum + part, 0);
	if (total === 0) {
		return parts.map(() => 0);
	}
	const exact = parts.map((part) => (part * 100) / total);
	const percents = exact.map(Math.floor);
	// The percents that rounding down lost go to the parts with the largest remainders, one each.
	const lost = 100 - percents.reduce((sum, percent) => sum + percent, 0);
	const byRemainder = exact
		.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
		.sort((first, second) => second.remainder - first.remainder);
	for (const { index } of byRemainder.slice(0, lost)) {
		percents[index] = (percents[index] ?? 0) + 1;
	}
	return percents.map((percent) => percent / 100);
}

/**
 * The sums of a day table over the last `days` complete days and over the `days` days before.
 * Yesterday is index 1. Today (index 0) is not complete, so no total reads it.
 */
export function sumPeriod(dayTable: number[], days: number): PeriodTotals {
	let current = 0;
	let previous = 0;
	for (let daysAgo = 1; daysAgo <= days; daysAgo++) {
		current += dayTable[daysAgo] ?? 0;
		previous += dayTable[daysAgo + days] ?? 0;
	}
	return { current, previous };
}

/**
 * The last `days` complete days of a day table as chart points, oldest first.
 * `todayStart` is the local midnight of today. A SQL read function does the same later (generate_series).
 */
export function toDailyPoints(
	dayTable: number[],
	days: number,
	todayStart: number,
): DailyPoint[] {
	return Array.from({ length: days }, (_, index) => {
		const daysAgo = days - index;
		return {
			day: dayKeyOf(startOfDayAgo(todayStart, daysAgo)),
			current: dayTable[daysAgo] ?? 0,
			previous: dayTable[daysAgo + days] ?? 0,
		};
	});
}
