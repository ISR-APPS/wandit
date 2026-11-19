// Shared math of the chart and KPI data: the period choices, the change ratio, and the totals by day and by quarter.
// The query files of the overview, the reps, and the targets build their values with it.
// changeRatio is the one change formula of the app, so every delta compares the same way.
// BAR_RADIUS_PX gives the bar corner of the bookings chart from the theme radius.
import type { AppThemeFile } from "~/styles/theme";
import type { OrderRow, TargetRow } from "./sample-data";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
export const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** The period choices of a trend panel, in days. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** The booked amount (cancelled orders excluded) of each day number in `orders`. */
export function bookedByDay(orders: OrderRow[]): Map<number, number> {
	const totals = new Map<number, number>();
	for (const order of orders) {
		if (!order.isCancelled) {
			totals.set(order.day, (totals.get(order.day) ?? 0) + order.amount);
		}
	}
	return totals;
}

/** The team target of each quarter, keyed by the day number of its first day. */
export function teamTargetByQuarter(targets: TargetRow[]): Map<number, number> {
	const totals = new Map<number, number>();
	for (const target of targets) {
		totals.set(
			target.quarterStartDay,
			(totals.get(target.quarterStartDay) ?? 0) + target.amount,
		);
	}
	return totals;
}
