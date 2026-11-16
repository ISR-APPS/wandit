// Reads of the fleet: every vehicle with its status, its driver of today, and its load of today.
// The fleet route prefetches the list. The fleet page and the vehicle panel read it from the cache.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	daysAgoOf,
	getSampleTables,
	isOpenStatus,
	type VehicleKind,
	type VehicleStatus,
} from "~/features/logistics";

/** One vehicle with the figures of today. The times are ISO texts. */
export type Vehicle = {
	id: string;
	/** The fleet number on the door, for example "B-05". */
	unit: string;
	kind: VehicleKind;
	plate: string;
	depotName: string;
	/** The largest payload, in kilograms. */
	capacityKg: number;
	/** How many pallets fit on the floor. */
	palletSpaces: number;
	odometerKm: number;
	/** The fuel level from 0 to 100. */
	fuelPercent: number;
	serviceDueAt: string;
	/** Calendar days from today to the next service. Negative for an overdue service. */
	serviceInDays: number;
	lastInspectionAt: string;
	/** Why the vehicle is in the workshop. null when it is fit for the road. */
	workshopNote: string | null;
	status: VehicleStatus;
	/** The driver of the open load. null for a vehicle with no load. */
	driverName: string | null;
	/** The weight of the open shipments on the vehicle, in kilograms. */
	loadKg: number;
	/** The pallets of the open shipments on the vehicle. */
	loadPallets: number;
	/** The count of open shipments on the vehicle. */
	stopCount: number;
};

/** Every vehicle, in fleet number order. The status comes from the workshop note and the open shipments. */
export function vehiclesQueryOptions() {
	return queryOptions({
		queryKey: ["vehicles", "list"],
		queryFn: async (): Promise<Vehicle[]> => {
			const tables = getSampleTables();
			const depots = new Map(tables.depots.map((row) => [row.id, row]));
			const drivers = new Map(tables.drivers.map((row) => [row.id, row]));
			const openShipments = tables.shipments.filter((row) =>
				isOpenStatus(row.status),
			);
			return tables.vehicles.map((row) => {
				const load = openShipments.filter(
					(shipment) => shipment.vehicleId === row.id,
				);
				const driverId = load[0]?.driverId;
				// A vehicle in the workshop takes no load. A load in transit puts the vehicle on the road.
				const status: VehicleStatus = row.workshopNote
					? "workshop"
					: load.some((shipment) => shipment.status === "in_transit")
						? "on_route"
						: load.length > 0
							? "loading"
							: "available";
				return {
					id: row.id,
					unit: row.unit,
					kind: row.kind,
					plate: row.plate,
					depotName: depots.get(row.depotId)?.name ?? "",
					capacityKg: row.capacityKg,
					palletSpaces: row.palletSpaces,
					odometerKm: row.odometerKm,
					fuelPercent: row.fuelPercent,
					serviceDueAt: row.serviceDueAt,
					serviceInDays: -daysAgoOf(row.serviceDueAt, tables.dayStart),
					lastInspectionAt: row.lastInspectionAt,
					workshopNote: row.workshopNote,
					status,
					driverName: driverId ? (drivers.get(driverId)?.name ?? null) : null,
					loadKg: load.reduce((sum, shipment) => sum + shipment.weightKg, 0),
					loadPallets: load.reduce(
						(sum, shipment) => sum + shipment.pallets,
						0,
					),
					stopCount: load.length,
				};
			});
		},
	});
}
