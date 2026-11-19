// Reads of the header alerts: the late open shipments, the unassigned shipments, and the vehicles past their service day.
// HeaderNotifications reads it after the shell renders. The late rule comes from lib/lateness.ts,
// so the bell counts the same late shipments as the "Late" figure of the home.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { lateDaysOf } from "../lib/lateness";
import { getSampleTables } from "../lib/sample-data";
import { daysAgoOf } from "../lib/series";
import { isOpenStatus } from "../lib/shipment-status";

// A shipment alert opens the page of its shipment. linkOptions types the path, so a wrong path fails typecheck.
function shipmentLink(shipmentId: string) {
	return linkOptions({
		to: "/app/shipments/$shipmentId",
		params: { shipmentId },
	});
}

// A vehicle has no page of its own, so its alert opens the fleet list.
function fleetLink() {
	return linkOptions({ to: "/app/fleet" });
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "lateShipment": open after its due day. "unassigned": no driver yet. "serviceOverdue": a vehicle past its service day. */
	kind: "lateShipment" | "unassigned" | "serviceOverdue";
	/** The shipment reference, or the fleet number of the vehicle. */
	title: string;
	/** The customer of the shipment, or the plate of the vehicle. */
	detail: string;
	/** ISO time: the due time of the shipment, or the service day of the vehicle. */
	at: string;
	link: ReturnType<typeof shipmentLink> | ReturnType<typeof fleetLink>;
};

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const tables = getSampleTables();
			const customers = new Map(
				tables.customers.map((customer) => [customer.id, customer.name]),
			);
			const open = tables.shipments.filter((row) => isOpenStatus(row.status));
			const late: Alert[] = open
				.filter((row) => lateDaysOf(row, tables.dayStart) > 0)
				.map((row) => ({
					id: row.id,
					kind: "lateShipment",
					title: row.reference,
					detail: customers.get(row.customerId) ?? "",
					at: row.dueAt,
					link: shipmentLink(row.id),
				}));
			// A late unassigned shipment is already a late alert, so it shows once.
			const unassigned: Alert[] = open
				.filter(
					(row) =>
						row.status === "unassigned" &&
						lateDaysOf(row, tables.dayStart) === 0,
				)
				.map((row) => ({
					id: row.id,
					kind: "unassigned",
					title: row.reference,
					detail: customers.get(row.customerId) ?? "",
					at: row.dueAt,
					link: shipmentLink(row.id),
				}));
			const service: Alert[] = tables.vehicles
				.filter(
					(vehicle) => daysAgoOf(vehicle.serviceDueAt, tables.dayStart) > 0,
				)
				.map((vehicle) => ({
					id: vehicle.id,
					kind: "serviceOverdue",
					title: vehicle.unit,
					detail: vehicle.plate,
					at: vehicle.serviceDueAt,
					link: fleetLink(),
				}));
			return [...late, ...unassigned, ...service].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
