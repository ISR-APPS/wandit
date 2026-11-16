// Rules of purchase orders that more than one page reads: when an open order is late, and when a delivery was on time.
// The order list, the order panel, the item page, the supplier panel, and the home rail use lateDaysOf.
// The home figures and the supplier record use deliveryDelayDays and isDeliveredOnTime.
import type { PurchaseOrderRow } from "./sample-data";
import { isOpenOrderStatus } from "./statuses";
import { calendarDaysBetween } from "./time";

/**
 * Full days after the expected day, for an order that still waits for goods. 0 when it is on time or closed.
 * An order expected yesterday is 1 day late today: the supplier had the whole expected day.
 */
export function lateDaysOf(
	order: PurchaseOrderRow,
	todayStart: number,
): number {
	if (!isOpenOrderStatus(order.status)) {
		return 0;
	}
	return Math.max(
		0,
		calendarDaysBetween(Date.parse(order.expectedOn), todayStart),
	);
}

/** Calendar days from the expected day to the last delivery. 0 or less is on time. null when nothing arrived yet. */
export function deliveryDelayDays(order: PurchaseOrderRow): number | null {
	const last = order.receipts.at(-1);
	return last
		? calendarDaysBetween(
				Date.parse(order.expectedOn),
				Date.parse(last.receivedAt),
			)
		: null;
}

/** true when the last delivery came on or before the expected day: the supplier had the whole expected day. */
export function isDeliveredOnTime(order: PurchaseOrderRow): boolean {
	const delay = deliveryDelayDays(order);
	return delay !== null && delay <= 0;
}
