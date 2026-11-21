// The KPI item of the home data, plus the one change formula.
// overview-data.ts builds the items. The KPI cards, the team highlights, and ChangeLine read the type.

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
