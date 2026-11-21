// The period choices of the home and the one change formula of the app.
// The period select, the dashboard query, and the plans query use them.
// A delta always compares a window with the window of the same length just before it.

/** The period choices of the home, in days. The sample keeps 182 days: 90 days and the 90 before. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** Change against the previous value, as a ratio: 0.12 is +12 %. null when the previous value is 0. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
