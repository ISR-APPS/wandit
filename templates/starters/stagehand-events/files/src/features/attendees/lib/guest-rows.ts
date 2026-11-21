// The rows of the attendees page: one row per order of every event, with its event and its door status.
// attendees.queries.ts builds them. The table, its filters, and the order panel read them.
import {
	type AttendanceStatus,
	attendanceOf,
	type BoxOffice,
	type EventSummary,
	type Order,
} from "~/features/organiser";

/** One order of the guest list, with its event and its door status at the time of the load. */
export type GuestRow = Order & {
	status: AttendanceStatus;
	event: EventSummary;
};

// The time of the last door or refund change of an order, or of the order itself.
function lastActivityOf(order: Order): number {
	return Math.max(
		order.placedAt,
		order.checkedInAt ?? 0,
		order.refundedAt ?? 0,
	);
}

/** Every order of every event, the latest activity first: a scan or a refund moves an order up. */
export function buildGuestRows(box: BoxOffice): GuestRow[] {
	const events = new Map(box.events.map((event) => [event.id, event]));
	const rows: GuestRow[] = [];
	for (const order of box.orders) {
		const event = events.get(order.eventId);
		// Every order belongs to an event of the same load. A missing event means a broken sample, so skip the row.
		if (!event) {
			continue;
		}
		rows.push({ ...order, status: attendanceOf(order, event, box.now), event });
	}
	return rows.sort(
		(first, second) => lastActivityOf(second) - lastActivityOf(first),
	);
}
