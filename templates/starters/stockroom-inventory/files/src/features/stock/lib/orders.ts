// Rules of purchase orders that more than one page reads: when an open order is late, and when a delivery was on time.
// The order list, the order panel, the item page, the supplier list, and the alerts use lateDaysOf.
// The home cards and the supplier list use deliveryDelayDays, isDeliveredOnTime, and isOpenAt.
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

/**
 * true when the order waited for goods at the time `at` (ms since 1970):
 * it was sent, it was not cancelled yet, and not every unit had arrived.
 */
export function isOpenAt(order: PurchaseOrderRow, at: number): boolean {
	if (order.orderedAt === null || Date.parse(order.orderedAt) > at) {
		return false;
	}
	if (order.cancelledAt !== null && Date.parse(order.cancelledAt) <= at) {
		return false;
	}
	const ordered = order.lines.reduce(
		(sum, line) => sum + line.quantityOrdered,
		0,
	);
	const received = order.receipts
		.filter((receipt) => Date.parse(receipt.receivedAt) <= at)
		.reduce((sum, receipt) => sum + receipt.units, 0);
	return received < ordered;
}
