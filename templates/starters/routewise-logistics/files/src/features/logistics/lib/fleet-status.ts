// The statuses of a vehicle and of a driver, the vehicle kinds, and the Badge variant of each status.
// The fleet and driver queries derive a status from the open shipments. The pages show it as a Badge and as a tab.
import type { BadgeVariant } from "./shipment-status";

/** Every vehicle status, in the order of the tabs. */
export const VEHICLE_STATUSES = [
	"on_route",
	"loading",
	"available",
	"workshop",
] as const;

/** One vehicle status. Its label is the message key `vehicleStatus.<status>`. */
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

/** Badge variant per vehicle status. A vehicle in the workshop cannot take a load, so it is the warning one. */
export const VEHICLE_STATUS_BADGE = {
	on_route: "info",
	loading: "secondary",
	available: "success",
	workshop: "warning",
} satisfies Record<VehicleStatus, BadgeVariant>;

/** Every driver status, in the order of the tabs. */
export const DRIVER_STATUSES = [
	"on_route",
	"loading",
	"available",
	"off_duty",
] as const;

/** One driver status. Its label is the message key `driverStatus.<status>`. */
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

/** Badge variant per driver status. Off duty is closed for today, so it is the outline one. */
export const DRIVER_STATUS_BADGE = {
	on_route: "info",
	loading: "secondary",
	available: "success",
	off_duty: "outline",
} satisfies Record<DriverStatus, BadgeVariant>;

/** The vehicle kinds of the fleet, the smallest first. */
export const VEHICLE_KINDS = ["van", "box_truck", "rigid", "chilled"] as const;

/** One vehicle kind. Its label is the message key `vehicleKind.<kind>`. */
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

/** The licence classes of the drivers. B drives a van, C1 a box or chilled truck, C every vehicle of the fleet. */
export const LICENCE_CLASSES = ["B", "C1", "C"] as const;

/** One licence class. It is shown as it is, with no translation. */
export type LicenceClass = (typeof LICENCE_CLASSES)[number];
