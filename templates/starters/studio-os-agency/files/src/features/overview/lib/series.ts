// Shapes of the home data: daily points, breakdown slices, and KPI items, plus the one change formula.
// overview-data.ts builds them. The entity rows, the trend cards, the breakdown, and the figures take the types.

/** One day of a trend. `day` is a local "YYYY-MM-DD". `previous` is the same day one period earlier. */
export type DailyPoint = {
	day: string;
	current: number;
	previous: number;
};

/** One part of a breakdown. `label` is a service code; the page translates it. */
export type BreakdownSlice = {
	label: string;
	value: number;
};

/** One KPI figure of the home. The page maps its id to a message key. */
export type KpiItem = {
	/** Stable id, also the React key, for example "billable-hours". */
	id: string;
	value: number;
	/** Intl options of the value, for example { style: "percent" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "points" for a figure that is itself a share: `change` is then a difference, 0.16 is +16 pts. */
	changeUnit?: "points";
	/** "down" for costs, delays, and late money: a fall is good news. */
	goodWhen: "up" | "down";
};

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
