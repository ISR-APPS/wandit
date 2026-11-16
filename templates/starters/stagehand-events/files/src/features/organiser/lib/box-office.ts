// The box office: every event with its venue, its status, and its sales, plus every order.
// The queries of the overview, events, attendees, and venues features call loadBoxOffice.
// One rule set derives every count, so the home, the lists, and the detail pages show the same numbers.

import { type EventRow, listEvents, type TicketTier } from "./sample-events";
import { buildOrders, type Order } from "./sample-orders";
import { findVenue, type Venue } from "./sample-venues";
import { MINUTE_MS } from "./time";

/** The statuses of an event, in the order of its life. Each one has the label `events.statuses.<status>`. */
export const EVENT_STATUSES = [
	"announced",
	"on_sale",
	"sold_out",
	"live",
	"completed",
	"cancelled",
] as const;

/** One status of an event. */
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** The door statuses of an order. Each one has the label `attendees.statuses.<status>`. */
export const ATTENDANCE_STATUSES = [
	"expected",
	"checked_in",
	"no_show",
	"refunded",
] as const;

/** One door status of an order. */
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** The sales of one tier. */
export type TierSales = TicketTier & {
	/** Valid tickets: refunded tickets do not count. A cancelled event counts the tickets sold before the cancellation. */
	sold: number;
	/** sold x price, in whole euros. */
	gross: number;
};

/** One event with its venue and the totals of its orders at the time of the load. */
export type EventSummary = EventRow & {
	venue: Venue;
	status: EventStatus;
	/** Valid tickets: the sum of the quantities of the orders that are not refunded. */
	sold: number;
	/** The ticket revenue of the valid tickets, in whole euros. */
	gross: number;
	/** Tickets of the orders that the door scanned. */
	checkedIn: number;
	/** Tickets of the refunded orders. */
	refundedTickets: number;
	/** The amount paid back on the refunded orders, in whole euros. */
	refundedGross: number;
	/** Orders that are not refunded. */
	orderCount: number;
	tierSales: TierSales[];
};

/** Everything that the pages read. `now` is the time of the load, in milliseconds since 1970. */
export type BoxOffice = {
	now: number;
	/** Every event, the earliest first. */
	events: EventSummary[];
	/** Every order of every event, grouped by event, oldest first in each group. */
	orders: Order[];
};

/** The door status of one order at `now`. */
export function attendanceOf(
	order: Order,
	event: EventRow,
	now: number,
): AttendanceStatus {
	if (order.refundedAt !== null) {
		return "refunded";
	}
	if (order.checkedInAt !== null) {
		return "checked_in";
	}
	return event.endsAt <= now ? "no_show" : "expected";
}

// The status follows the clock first, then the sales.
function statusOf(event: EventRow, sold: number, now: number): EventStatus {
	if (event.cancelledAt !== null && event.cancelledAt <= now) {
		return "cancelled";
	}
	if (event.endsAt <= now) {
		return "completed";
	}
	if (event.doorsAt <= now) {
		return "live";
	}
	if (event.onSaleAt > now) {
		return "announced";
	}
	// Sold out means no ticket is left. A refund puts its tickets back on sale.
	return sold >= event.capacity ? "sold_out" : "on_sale";
}

function summarize(
	event: EventRow,
	orders: Order[],
	now: number,
): EventSummary {
	const venue = findVenue(event.venueId);
	if (!venue) {
		throw new Error(`Unknown venue ${event.venueId} for ${event.id}`);
	}
	const valid = orders.filter((order) => order.refundedAt === null);
	const refunded = orders.filter((order) => order.refundedAt !== null);
	const sold = valid.reduce((sum, order) => sum + order.quantity, 0);
	const status = statusOf(event, sold, now);
	// A cancelled event refunds every order. Its tiers show the sales before the cancellation, as its sales card does.
	const tierOrders = status === "cancelled" ? orders : valid;
	return {
		...event,
		venue,
		status,
		sold,
		gross: valid.reduce((sum, order) => sum + order.amount, 0),
		checkedIn: valid
			.filter((order) => order.checkedInAt !== null)
			.reduce((sum, order) => sum + order.quantity, 0),
		refundedTickets: refunded.reduce((sum, order) => sum + order.quantity, 0),
		refundedGross: refunded.reduce((sum, order) => sum + order.amount, 0),
		orderCount: valid.length,
		tierSales: event.tiers.map((tier) => {
			const tierSold = tierOrders
				.filter((order) => order.tierId === tier.id)
				.reduce((sum, order) => sum + order.quantity, 0);
			return { ...tier, sold: tierSold, gross: tierSold * tier.price };
		}),
	};
}

// The last load. Every query of one page load reads the same minute, so the pages agree.
let cached: { minute: number; value: BoxOffice } | null = null;

/** The box office at `now`. The result is the same for every call in the same minute. */
export function loadBoxOffice(now: number): BoxOffice {
	const minute = Math.floor(now / MINUTE_MS);
	if (cached?.minute === minute) {
		return cached.value;
	}
	const events: EventSummary[] = [];
	const orders: Order[] = [];
	for (const event of listEvents(now)) {
		const eventOrders = buildOrders(event, now);
		events.push(summarize(event, eventOrders, now));
		orders.push(...eventOrders);
	}
	cached = { minute, value: { now, events, orders } };
	return cached.value;
}
