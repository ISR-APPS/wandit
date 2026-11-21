// The rules of the header alerts: an event that sells slowly close to its day, and a new refund request.
// alertsQueryOptions calls buildAlerts on the box office. HeaderNotifications shows the result.
import { linkOptions } from "@tanstack/react-router";
import type { BoxOffice } from "./box-office";
import { DAY_MS, HOUR_MS } from "./time";

// An event this close to its start with less than half of its seats sold needs a push.
const SLOW_SALE_WINDOW_MS = 7 * DAY_MS;
const SLOW_SALE_SHARE = 0.5;
// A refund that a buyer asked for in the last 48 hours is news for the organiser.
const NEW_REFUND_WINDOW_MS = 48 * HOUR_MS;

// linkOptions types each path, so a wrong path fails typecheck.
function eventLink(eventId: string) {
	return linkOptions({ to: "/app/events/$eventId", params: { eventId } });
}
function orderLink(orderId: string) {
	return linkOptions({ to: "/app/attendees", search: { order: orderId } });
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "slowSale": an on-sale event in the next 7 days under half sold. "refundRequest": a buyer refund of the last 48 hours. */
	kind: "slowSale" | "refundRequest";
	/** The event name, or the buyer name of the refund. */
	title: string;
	/** The venue of the event, or the event of the refund. */
	detail: string;
	/** Milliseconds since 1970: the start of the event, or the time of the refund. */
	at: number;
	link: ReturnType<typeof eventLink> | ReturnType<typeof orderLink>;
};

/** The slow events (the soonest first), then the new refunds (the newest first). */
export function buildAlerts(box: BoxOffice): Alert[] {
	const slowSales: Alert[] = box.events
		.filter(
			(event) =>
				event.status === "on_sale" &&
				event.startsAt - box.now <= SLOW_SALE_WINDOW_MS &&
				event.sold / event.capacity < SLOW_SALE_SHARE,
		)
		.map((event) => ({
			id: event.id,
			kind: "slowSale",
			title: event.name,
			detail: event.venue.name,
			at: event.startsAt,
			link: eventLink(event.id),
		}));
	// A cancelled event refunds every order by itself. Those refunds are not requests.
	const eventNames = new Map(
		box.events
			.filter((event) => event.cancelledAt === null)
			.map((event) => [event.id, event.name]),
	);
	const refunds: Alert[] = box.orders
		.filter(
			(order) =>
				order.refundedAt !== null &&
				order.refundedAt <= box.now &&
				box.now - order.refundedAt <= NEW_REFUND_WINDOW_MS &&
				eventNames.has(order.eventId),
		)
		.map(
			(order): Alert => ({
				id: order.id,
				kind: "refundRequest",
				title: order.buyerName,
				detail: eventNames.get(order.eventId) ?? "",
				// The filter above keeps only refunded orders.
				at: order.refundedAt ?? box.now,
				link: orderLink(order.id),
			}),
		)
		.sort((first, second) => second.at - first.at);
	return [...slowSales, ...refunds];
}
