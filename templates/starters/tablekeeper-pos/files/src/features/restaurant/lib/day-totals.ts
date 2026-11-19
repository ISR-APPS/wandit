// The totals of a business day and the one change formula of the app.
// The sales home, the menu page, and the day report call these, so every delta compares the same way.
// The callers pass the checks of listOrders and the days of listDailyHistory.
import { isCountedOrder, orderSubtotalCents } from "./order-math";
import type { DailyTotals, TodayTotals } from "./sample-history";
import type { Order } from "./sample-orders";

/** Change against the previous value, as a ratio: 0.12 is +12 %. null when the previous value is 0, so no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** Checks, covers, and sales of the business day so far. Voids do not count. */
export function totalsOfToday(orders: Order[]): TodayTotals {
	const counted = orders.filter(isCountedOrder);
	return {
		checks: counted.length,
		covers: counted.reduce((sum, order) => sum + order.covers, 0),
		salesCents: counted.reduce(
			(sum, order) => sum + orderSubtotalCents(order),
			0,
		),
	};
}

/**
 * The same weekday last week, cut at the time of now. A restaurant compares a Saturday with the Saturday before.
 * Each total of last week scales by the part of the planned day that today has reached: `plannedNow` of `plannedDay`.
 * The callers pass today's totals as `plannedNow`. So a lunch compares with a lunch. undefined with under a week of history.
 */
export function sameTimeLastWeek(
	history: DailyTotals[],
	plannedNow: TodayTotals,
	plannedDay: TodayTotals,
): TodayTotals | undefined {
	// history ends with yesterday, so the 7th entry from the end is the same weekday last week.
	const lastWeek = history.at(-7);
	const scale = (value: number, now: number, day: number) =>
		day === 0 ? 0 : Math.round((value * now) / day);
	return lastWeek
		? {
				checks: scale(lastWeek.checks, plannedNow.checks, plannedDay.checks),
				covers: scale(lastWeek.covers, plannedNow.covers, plannedDay.covers),
				salesCents: scale(
					lastWeek.salesCents,
					plannedNow.salesCents,
					plannedDay.salesCents,
				),
			}
		: undefined;
}

/** A signed percent formatter with one decimal, for example "+3.6%". "exceptZero" never writes "+0%". */
export function changeFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
}

/** True when `change` is good news: a rise for a figure where up is good, a fall where down is good. */
export function isGoodChange(change: number, goodWhen: "up" | "down"): boolean {
	return change > 0 === (goodWhen === "up");
}
