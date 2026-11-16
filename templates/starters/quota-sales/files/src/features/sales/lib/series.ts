// Shapes and math of the chart and KPI data: daily points, breakdown slices, KPI items, and the change ratio.
// The query files build these values from the sample orders. The KPI, trend, and breakdown panels take the types.
// changeRatio is the one change formula of the app, so every delta compares the same way.
// BAR_RADIUS_PX gives the bar corner of both bar charts from the theme radius.
import type { AppThemeFile } from "~/styles/theme";
import { dayKeyOf, quarterOfDay } from "./calendar";
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

/** One day of a trend, oldest first in a list. Zero on a day with no booking. */
export type DailyPoint = {
	/** YYYY-MM-DD. */
	day: string;
	/** Booked amount of the day. */
	current: number;
	/** Booked amount of the same day one period earlier. */
	previous: number;
	/** The share of the team target for the day: the quarter target divided by the days of the quarter. */
	target: number;
};

/** One part of a breakdown. `label` is ready to show. */
export type BreakdownSlice = { label: string; value: number };

/** One KPI figure of the home. */
export type KpiItem = {
	/** Stable id, also the React key, for example "bookings". */
	id: string;
	/** Label, already translated. */
	label: string;
	value: number;
	/** Intl options of the value, for example { style: "percent" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** The change against the previous period of the same length. null hides the delta. */
	change: number | null;
	/**
	 * "ratio": a relative change, 0.12 is +12 %.
	 * "points": the difference of two ratios, for a value that is itself a percent. -0.009 is -0.9 pts.
	 */
	changeKind: "ratio" | "points";
	/** "down" for costs, delays, and cancellations: a fall is good news. */
	goodWhen: "up" | "down";
};

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

/**
 * The `days` days that end yesterday, oldest first, with the same days one period earlier.
 * `target` spreads the team target of each quarter evenly over its days.
 */
export function buildDailySeries(
	orders: OrderRow[],
	targets: TargetRow[],
	today: number,
	days: number,
): DailyPoint[] {
	const booked = bookedByDay(orders);
	const quarterTargets = teamTargetByQuarter(targets);
	return Array.from({ length: days }, (_, index) => {
		const day = today - days + index;
		const quarter = quarterOfDay(day);
		return {
			day: dayKeyOf(day),
			current: booked.get(day) ?? 0,
			previous: booked.get(day - days) ?? 0,
			target:
				(quarterTargets.get(quarter.startDay) ?? 0) /
				(quarter.endDay - quarter.startDay),
		};
	});
}
