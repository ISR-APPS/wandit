// The statuses of a shipment, its service levels, its delivery outcomes, and the reasons of a late or failed delivery.
// A later `shipments` table keeps the same values as check constraints.
// The sample tables, the query files, the badges, and the tabs of every page read this file.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of the work. The tabs follow this order. */
export const SHIPMENT_STATUSES = [
	"unassigned",
	"scheduled",
	"in_transit",
	"delivered",
	"failed",
] as const;

/** One status. Its label is the message key `shipmentStatus.<status>`. */
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** The statuses of a shipment that the desk still works on. Delivered and failed are the end statuses. */
export const OPEN_SHIPMENT_STATUSES = [
	"unassigned",
	"scheduled",
	"in_transit",
] as const satisfies readonly ShipmentStatus[];

/** One open status. The queue of the home has one tab for each. */
export type OpenShipmentStatus = (typeof OPEN_SHIPMENT_STATUSES)[number];

/** True while the desk still works on the shipment: it is not delivered and not failed. */
export function isOpenStatus(
	status: ShipmentStatus,
): status is OpenShipmentStatus {
	return status !== "delivered" && status !== "failed";
}

/** A Badge variant name of the kit. */
export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

/** Badge variant per status. Unassigned needs an action, so it is the warning one. */
export const SHIPMENT_STATUS_BADGE = {
	unassigned: "warning",
	scheduled: "secondary",
	in_transit: "info",
	delivered: "success",
	failed: "destructive",
} satisfies Record<ShipmentStatus, BadgeVariant>;

/** The service levels a customer can book. Chilled goods need a chilled truck. */
export const SERVICE_LEVELS = ["standard", "express", "chilled"] as const;

/** One service level. Its label is the message key `serviceLevel.<level>`. */
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

/** The reasons of a late or failed delivery, the most frequent first. */
export const EXCEPTION_REASONS = [
	"traffic",
	"loading_delay",
	"recipient_absent",
	"vehicle_breakdown",
	"address_problem",
] as const;

/** One reason. Its label is the message key `exceptionReason.<reason>`. */
export type ExceptionReason = (typeof EXCEPTION_REASONS)[number];

/** The outcomes of a closed shipment, in the stack order of the trend chart: the first one sits at the bottom. */
export const DELIVERY_OUTCOMES = ["on_time", "late", "failed"] as const;

/** One outcome. Its label is the message key `deliveryOutcome.<outcome>`. */
export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number];
