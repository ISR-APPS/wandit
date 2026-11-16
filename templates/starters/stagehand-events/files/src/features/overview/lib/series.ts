// Shapes of the home data: daily points and KPI items, and the one change formula of the app.
// overview-math.ts builds them from the box office. The hero and the facts row take the types.

/** The period choices of the revenue hero, in days. The sample series covers 90 days and the 90 before. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice of the hero. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** One day of a trend, oldest first in a list. Zero on a day with no sale. */
export type DailyPoint = {
	/** The local day, `YYYY-MM-DD`. */
	day: string;
	/** The value of the day. */
	current: number;
	/** The value of the same day one period earlier. */
	previous: number;
};

/** One KPI figure of the facts row. Code builds it from the box office, so it has no schema. */
export type KpiItem = {
	/** Stable id, also the React key, for example "tickets". */
	id: string;
	/** Label, already translated. */
	label: string;
	value: number;
	/** Intl options of the value, for example { style: "percent" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for refunds and other losses: a fall is good news. */
	goodWhen: "up" | "down";
	/** One value per day, oldest first. Only the spark reads it. */
	series?: number[];
};

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
