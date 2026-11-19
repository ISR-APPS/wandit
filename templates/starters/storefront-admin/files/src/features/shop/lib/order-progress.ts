// Pure rules of the fulfilment of one order: its stage on the shelf, the late rule, and the steps of its timeline.
// The order table, the order page, the home delivery card, and the header alerts call them, so they agree.
import {
	type OrderStatus,
	SHIP_TARGET_DAYS,
	type ShippingMethod,
} from "./order-status";
import { calendarDaysFromNow, DAY_MS } from "./relative-time";

/** Where an order that is not shipped yet stands. `late` wins over the two other values. */
export type ShelfStage = "to_pack" | "packed" | "late";

/** The part of an order that the shelf rules read. */
type ShelfOrder = {
	status: OrderStatus;
	placedAt: string;
	packedAt: string | null;
	shippingMethod: ShippingMethod;
};

// The count of days in which an order of this delivery choice must leave.
function targetDaysOf(shippingMethod: ShippingMethod): number {
	return shippingMethod === "express" ? 1 : SHIP_TARGET_DAYS;
}

/** The time by which an order must leave, in milliseconds since 1970. The home list puts the smallest value first. */
export function shipByOf(order: {
	placedAt: string;
	shippingMethod: ShippingMethod;
}): number {
	return (
		Date.parse(order.placedAt) + targetDaysOf(order.shippingMethod) * DAY_MS
	);
}

/**
 * The shelf stage of an order to ship, or null for every other status.
 * Product rule: a standard order ships within SHIP_TARGET_DAYS days, and an express order on the next day.
 */
export function shelfStageOf(
	order: ShelfOrder,
	now: number,
): ShelfStage | null {
	if (order.status !== "to_ship") {
		return null;
	}
	const waitedDays = -calendarDaysFromNow(order.placedAt, now);
	if (waitedDays > targetDaysOf(order.shippingMethod)) {
		return "late";
	}
	return order.packedAt ? "packed" : "to_pack";
}

/** The steps of the timeline, in order. An order ends with `delivered`, `cancelled`, or `refunded`. */
export type TimelineStepId =
	| "placed"
	| "paid"
	| "packed"
	| "shipped"
	| "delivered"
	| "cancelled"
	| "refunded";

/** One step of the timeline. `at` is null for a step that did not happen yet. */
export type TimelineStep = { id: TimelineStepId; at: string | null };

/** The times of an order that the timeline reads. */
type TimelineOrder = {
	placedAt: string;
	packedAt: string | null;
	shippedAt: string | null;
	deliveredAt: string | null;
	cancelledAt: string | null;
	refundedAt: string | null;
};

/**
 * The steps of one order, oldest first. Every sample order is paid at checkout, so `paid` has the time of `placed`.
 * A cancelled order stops at the cancel step. A refund comes after the delivery.
 */
export function timelineOf(order: TimelineOrder): TimelineStep[] {
	const start: TimelineStep[] = [
		{ id: "placed", at: order.placedAt },
		{ id: "paid", at: order.placedAt },
	];
	if (order.cancelledAt) {
		return [...start, { id: "cancelled", at: order.cancelledAt }];
	}
	const steps: TimelineStep[] = [
		...start,
		{ id: "packed", at: order.packedAt },
		{ id: "shipped", at: order.shippedAt },
		{ id: "delivered", at: order.deliveredAt },
	];
	return order.refundedAt
		? [...steps, { id: "refunded", at: order.refundedAt }]
		: steps;
}
