// The period choices of the home and the one change formula of the app.
// The page header select, the queries, and overview-math.ts use them.

/** The period choices of the home, in days. The sample orders cover 90 days and the 90 before. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice of the home. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
