// The period choices of every chart with a period control, and the one change formula of the app.
// The cash flow strip of the home and the balance chart of an account read the choices.
// The totals of the home and the position of the accounts page compute their deltas with changeRatio.

/** The period choices, in days. A 90-day period compares with the 90 days before, so the history keeps 186 days. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/**
 * Change against the period before, as a ratio. null when the earlier value is 0: no delta shows.
 * The size of the earlier value divides the difference, so a net result that leaves a loss reads as a rise.
 */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / Math.abs(previous);
}
