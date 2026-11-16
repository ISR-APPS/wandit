// Shapes of the chart and KPI data: daily points, breakdown slices, and KPI items.
// The overview, cards, and statements queries return them. The trend, strip, and breakdown panels take them.
// changeRatio is the one change formula of the portal, so every delta compares the same way.

/** The period choices of a trend panel, in days. The history holds twice the longest period. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice, in days. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** One day of a trend, in cents. `day` is `YYYY-MM-DD`. `previous` is the same day one period earlier. */
export type DailyPoint = {
	day: string;
	current: number;
	previous: number;
};

/** One part of a breakdown, in cents. `label` is a code until the page translates it. */
export type BreakdownSlice = {
	label: string;
	value: number;
};

/** One KPI figure. Every value of the portal is money, in cents. */
export type KpiItem = {
	/** Stable id, also the React key, for example "money-in". */
	id: string;
	/** Label, already translated. */
	label: string;
	/** Cents. */
	value: number;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for money out and card spend: a fall is good news. */
	goodWhen: "up" | "down";
};

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
