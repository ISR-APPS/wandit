// The late rule of the desk: a shipment is late from the day after its due day.
// The shipment, delivery, and driver queries call it, so every page counts late shipments the same way.
import type { ShipmentRow } from "./sample-data";
import { daysAgoOf } from "./series";
import type { DeliveryOutcome } from "./shipment-status";

/**
 * Calendar days between the due day and the day the shipment closed. An open shipment counts until today.
 * 0 is on time. `dayStart` is the midnight that starts today.
 */
export function lateDaysOf(
	shipment: Pick<ShipmentRow, "dueAt" | "closedAt">,
	dayStart: number,
): number {
	const closedDaysAgo = shipment.closedAt
		? daysAgoOf(shipment.closedAt, dayStart)
		: 0;
	return Math.max(0, daysAgoOf(shipment.dueAt, dayStart) - closedDaysAgo);
}

/** The outcome of a closed shipment. null while the shipment is open. */
export function outcomeOf(
	shipment: Pick<ShipmentRow, "status" | "dueAt" | "closedAt">,
	dayStart: number,
): DeliveryOutcome | null {
	if (shipment.status === "failed") {
		return "failed";
	}
	if (shipment.status !== "delivered") {
		return null;
	}
	return lateDaysOf(shipment, dayStart) > 0 ? "late" : "on_time";
}
