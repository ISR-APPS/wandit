// The media metrics: the sums of daily channel rows and the ratios that a marketing team reads.
// The query files of the overview, the campaigns, and the audiences call these pure functions.
// A ratio with a zero divisor is null, so a page shows "no data" and never a false 0 or an infinity.

/** The period choices of a trend panel, in days. The sample history holds 180 days, so 90 has a previous period. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The sums of a set of daily channel rows. Money is in whole units of CURRENCY (format.ts). */
export type MediaTotals = {
	spend: number;
	impressions: number;
	clicks: number;
	conversions: number;
	/** The order value that the conversions brought, as the ad platforms attribute it. */
	revenue: number;
};

/** Totals of zero, the start of a sum. */
export function emptyTotals(): MediaTotals {
	return { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
}

/** Adds the metrics of `row` into `totals` and returns `totals`. */
export function addTotals(totals: MediaTotals, row: MediaTotals): MediaTotals {
	totals.spend += row.spend;
	totals.impressions += row.impressions;
	totals.clicks += row.clicks;
	totals.conversions += row.conversions;
	totals.revenue += row.revenue;
	return totals;
}

/** Cost per conversion (CPA) in money. null with no conversion. */
export function costPerConversion(totals: MediaTotals): number | null {
	return totals.conversions === 0 ? null : totals.spend / totals.conversions;
}

/** Return on ad spend (ROAS): revenue for each unit of spend, 3.2 reads "3.2×". null with no spend. */
export function returnOnSpend(totals: MediaTotals): number | null {
	return totals.spend === 0 ? null : totals.revenue / totals.spend;
}

/** Click-through rate as a ratio: 0.012 is 1.2 %. null with no impression. */
export function clickRate(totals: MediaTotals): number | null {
	return totals.impressions === 0 ? null : totals.clicks / totals.impressions;
}

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
