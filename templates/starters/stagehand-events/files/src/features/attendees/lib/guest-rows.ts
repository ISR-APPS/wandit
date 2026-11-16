// The rows of the guest list: one row per order, with the door status at the time of the load.
// attendees.queries.ts builds them. The table, the tabs, the summary, and the side panel read them.
import {
	type AttendanceStatus,
	attendanceOf,
	type BoxOffice,
	type EventSummary,
	type Order,
} from "~/features/organiser";

/** One order of the guest list, with its door status. */
export type GuestRow = Order & { status: AttendanceStatus };

/** The guest list of one event, the newest order first. */
export function buildGuestRows(
	box: BoxOffice,
	event: EventSummary,
): GuestRow[] {
	return box.orders
		.filter((order) => order.eventId === event.id)
		.map((order) => ({ ...order, status: attendanceOf(order, event, box.now) }))
		.reverse();
}

/**
 * The events that have a guest list, in the order of the event picker:
 * the live events, then the events to come (the soonest first), then the past events (the newest first).
 */
export function guestListEvents(box: BoxOffice): EventSummary[] {
	const withOrders = box.events.filter((event) => event.status !== "announced");
	const live = withOrders.filter((event) => event.status === "live");
	const ahead = withOrders.filter(
		(event) => event.status !== "live" && event.endsAt > box.now,
	);
	const past = withOrders.filter((event) => event.endsAt <= box.now).reverse();
	return [...live, ...ahead, ...past];
}

/** The event of the guest list: the id of the URL when it has a guest list, else the first event of the picker. */
export function resolveGuestListEventId(
	requestedId: string | undefined,
	events: EventSummary[],
): string | undefined {
	return events.some((event) => event.id === requestedId)
		? requestedId
		: events[0]?.id;
}
