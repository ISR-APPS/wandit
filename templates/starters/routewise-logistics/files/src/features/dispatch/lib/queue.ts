// The order of the dispatch queue: the open shipments, the soonest due day first.
// The dispatch page and the /app loader call it. The first row of the result is the "Next up" shipment.
import { isOpenStatus, SHIPMENT_STATUSES } from "~/features/logistics";
import type { Shipment } from "~/features/shipments";

/** The largest count of rows that the queue of the home shows. "See all" opens the full list. */
export const QUEUE_SIZE = 10;

/**
 * The open shipments of `shipments` in work order: the oldest due day first, so the late rows lead.
 * On one due day, a shipment with no driver comes before a scheduled one, then the older booking.
 */
export function openQueue(shipments: Shipment[]): Shipment[] {
	// SHIPMENT_STATUSES lists the statuses in work order: unassigned, scheduled, in transit.
	const statusOrder = (shipment: Shipment) =>
		SHIPMENT_STATUSES.indexOf(shipment.status);
	// LIMIT: the queue filters the rows of the list query in the browser. Upgrade: a query for the open rows only.
	return shipments
		.filter((shipment) => isOpenStatus(shipment.status))
		.sort(
			(first, second) =>
				first.dueAt.localeCompare(second.dueAt) ||
				statusOrder(first) - statusOrder(second) ||
				first.bookedAt.localeCompare(second.bookedAt),
		);
}
