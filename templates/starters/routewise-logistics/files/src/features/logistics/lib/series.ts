// Shapes of the chart and figure data, and the day math that the query files share.
// The delivery queries build the series with these functions. The chart cards and the figure strip take the types.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import { DAY_MS, startOfLocalDay } from "./relative-time";

/** The period choices of a trend panel and of the shipment list, in days. The sample rows cover two periods of the longest one. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** One day and one category of a stacked trend, oldest day first. Every day has a row for every category. */
export type CategoryPoint<Category extends string = string> = {
	/** YYYY-MM-DD in the browser time zone. */
	day: string;
	/** A code. The page translates it before the chart gets it. */
	category: Category;
	value: number;
};

/** One part of a breakdown. `label` is a code; the page translates it before a panel gets it. */
export type BreakdownSlice<Label extends string = string> = {
	label: Label;
	value: number;
};

/** One figure of a strip, before translation of its label. */
export type Figure<LabelKey extends string = string> = {
	/** Stable id, also the React key, for example "on-time-rate". */
	id: string;
	/** Message key of the label. */
	labelKey: LabelKey;
	value: number;
	/** Intl options of the value, for example { style: "percent" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null when no earlier data exists. */
	change: number | null;
	/** "down" for late and failed deliveries: a fall is good news. */
	goodWhen: "up" | "down";
};

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** The local calendar day `daysAgo` days before the day that starts at `dayStart`, as YYYY-MM-DD. */
export function dayKey(dayStart: number, daysAgo: number): string {
	const date = new Date(dayStart);
	// setDate keeps the calendar day across a clock change. A subtraction of 24 hours does not.
	date.setDate(date.getDate() - daysAgo);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The date of a `day` key (YYYY-MM-DD), for an axis tick or a tooltip.
 * It is midnight UTC: format it with `timeZone: "UTC"` to keep the same calendar day.
 */
export function dayToDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

/** Full days between the local day of `timestamp` (ISO) and the day that starts at `dayStart`. 1 is yesterday, 0 is today. */
export function daysAgoOf(timestamp: string, dayStart: number): number {
	return Math.round(
		(dayStart - startOfLocalDay(Date.parse(timestamp))) / DAY_MS,
	);
}
