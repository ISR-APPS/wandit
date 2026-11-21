// The period of the home figures: the last 7, 30, or 90 calendar days, and the change against the period before.
// The period select, the dashboard queries, and the Reports tab read it.
// The book holds 90 days of history, so the 90-day period has no earlier period to compare.
import { addDays, startOfLocalDay } from "./clinic-day";

/** The period choices, in days. The book holds 90 days of history. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** Start and end of one period, in milliseconds since 1970. `end` is excluded. */
export type PeriodRange = { start: number; end: number };

/**
 * The last `days` calendar days, today included: "current".
 * "previous" is the `days` days before it, so a change compares two periods of the same length.
 */
export function periodRanges(
	days: number,
	now: number,
): { current: PeriodRange; previous: PeriodRange } {
	const tomorrowStart = addDays(startOfLocalDay(now), 1);
	const currentStart = addDays(tomorrowStart, -days);
	return {
		current: { start: currentStart, end: tomorrowStart },
		previous: { start: addDays(currentStart, -days), end: currentStart },
	};
}

/** True when the time `ms` is in the range. */
export function isInRange(ms: number, range: PeriodRange): boolean {
	return ms >= range.start && ms < range.end;
}

/** Change against the previous period, as a ratio: 0.12 is +12 %. null when the previous value is 0. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
