// Reads of the drivers: every driver with the status of today, the run of today, and the delivery figures of 30 days.
// The drivers route prefetches the list. The drivers page and the driver panel read it from the cache.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type DriverStatus,
	daysAgoOf,
	getSampleTables,
	isOpenStatus,
	type LicenceClass,
	outcomeOf,
} from "~/features/logistics";

/** The period of the delivery figures of a driver, in full days before today. */
export const DRIVER_STATS_DAYS = 30;

/** One driver with the figures of today and of the last DRIVER_STATS_DAYS days. */
export type Driver = {
	id: string;
	name: string;
	phone: string;
	licenceClass: LicenceClass;
	depotName: string;
	/** The first day at the company, as ISO. */
	hiredAt: string;
	status: DriverStatus;
	/** The fleet number of the vehicle of today, for example "B-05". null for a driver with no run. */
	vehicleUnit: string | null;
	/** The largest payload of that vehicle, in kilograms. null for a driver with no run. */
	vehicleCapacityKg: number | null;
	/** The count of open shipments of the driver. */
	stopCount: number;
	/** The weight of those shipments, in kilograms. */
	loadKg: number;
	/** Shipments delivered in the period, on time or late. */
	deliveredCount: number;
	/** Shipments delivered after their due day in the period. */
	lateCount: number;
	/** Deliveries that failed in the period. */
	failedCount: number;
	/** Delivered on time as a share of the delivered shipments. null when the driver delivered nothing. */
	onTimeRate: number | null;
};

/** Every driver, in name order. The status comes from the rest day flag and the open shipments. */
export function driversQueryOptions() {
	return queryOptions({
		queryKey: ["drivers", "list"],
		queryFn: async (): Promise<Driver[]> => {
			const tables = getSampleTables();
			const depots = new Map(tables.depots.map((row) => [row.id, row]));
			const vehicles = new Map(tables.vehicles.map((row) => [row.id, row]));
			return tables.drivers
				.map((row) => {
					const own = tables.shipments.filter(
						(shipment) => shipment.driverId === row.id,
					);
					const run = own.filter((shipment) => isOpenStatus(shipment.status));
					// Full days before today only, as in delivery-stats.ts, so the driver totals equal the totals of the home.
					const closed = own.filter((shipment) => {
						if (shipment.closedAt === null) {
							return false;
						}
						const daysAgo = daysAgoOf(shipment.closedAt, tables.dayStart);
						return daysAgo >= 1 && daysAgo <= DRIVER_STATS_DAYS;
					});
					const countOf = (outcome: "on_time" | "late" | "failed") =>
						closed.filter(
							(shipment) => outcomeOf(shipment, tables.dayStart) === outcome,
						).length;
					const onTimeCount = countOf("on_time");
					const lateCount = countOf("late");
					const vehicleId = run[0]?.vehicleId;
					// A load in transit puts the driver on the road. A scheduled load keeps the driver at the dock.
					const status: DriverStatus = row.isOffDuty
						? "off_duty"
						: run.some((shipment) => shipment.status === "in_transit")
							? "on_route"
							: run.length > 0
								? "loading"
								: "available";
					return {
						id: row.id,
						name: row.name,
						phone: row.phone,
						licenceClass: row.licenceClass,
						depotName: depots.get(row.depotId)?.name ?? "",
						hiredAt: row.hiredAt,
						status,
						vehicleUnit: vehicleId
							? (vehicles.get(vehicleId)?.unit ?? null)
							: null,
						vehicleCapacityKg: vehicleId
							? (vehicles.get(vehicleId)?.capacityKg ?? null)
							: null,
						stopCount: run.length,
						loadKg: run.reduce((sum, shipment) => sum + shipment.weightKg, 0),
						deliveredCount: onTimeCount + lateCount,
						lateCount,
						failedCount: countOf("failed"),
						onTimeRate:
							onTimeCount + lateCount === 0
								? null
								: onTimeCount / (onTimeCount + lateCount),
					};
				})
				.sort((first, second) => first.name.localeCompare(second.name));
		},
	});
}
