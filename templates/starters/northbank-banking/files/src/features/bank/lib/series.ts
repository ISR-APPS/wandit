// The period choices of the period select, and changeRatio, the one change formula of the portal.
// The overview, the cards page, and the cash flow card call changeRatio, so every delta compares the same way.

/** The period choices of the period select, in days. The history holds twice the longest period. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice, in days. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
