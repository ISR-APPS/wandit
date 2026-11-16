// The sales pace of one event: the valid tickets sold up to each day, from the first day of sale.
// For a cancelled event it counts every ticket sold before the cancellation, because all of them are refunded.
// eventQueryOptions builds it. SalesPaceCard draws it against the capacity of the event.
import {
	addDays,
	type EventSummary,
	type Order,
	startOfLocalDay,
	toIsoDay,
} from "~/features/organiser";

/** One day of the sales pace. */
export type PacePoint = {
	/** The local day, `YYYY-MM-DD`. */
	day: string;
	/** Valid tickets sold from the first day of sale to the end of this day. Refunded tickets too for a cancelled event. */
	total: number;
};

/** One point per day from the first day of sale to the event day, or to today when the event is ahead. */
export function buildSalesPace(
	event: EventSummary,
	orders: Order[],
	now: number,
): PacePoint[] {
	if (event.onSaleAt > now) {
		return [];
	}
	const perDay = new Map<string, number>();
	for (const order of orders) {
		// A cancelled event refunds every order. Without its refunded orders, its curve is a flat zero.
		if (order.refundedAt !== null && event.status !== "cancelled") {
			continue;
		}
		const day = toIsoDay(order.placedAt);
		perDay.set(day, (perDay.get(day) ?? 0) + order.quantity);
	}
	const firstDay = startOfLocalDay(event.onSaleAt);
	const lastDay = startOfLocalDay(
		Math.min(event.cancelledAt ?? event.startsAt, event.startsAt, now),
	);
	const points: PacePoint[] = [];
	let total = 0;
	for (
		let dayStart = firstDay;
		dayStart <= lastDay;
		dayStart = addDays(dayStart, 1)
	) {
		const day = toIsoDay(dayStart);
		total += perDay.get(day) ?? 0;
		points.push({ day, total });
	}
	return points;
}
