// The statuses of an order, the Badge variant of each one, and the rule that gives the status of an order.
// The orders list, the order dialog, the rep page, and the home table read this file.
// A real orders table stores the status in a column. Then orderStatusOf goes away.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of the fulfilment. The tabs follow this order. Labels: `orderStatuses.<status>`. */
export const ORDER_STATUSES = [
	"booked",
	"shipped",
	"invoiced",
	"paid",
	"cancelled",
] as const;

/** One order status. */
export type OrderStatus = (typeof ORDER_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per status. Paid is the only green one, cancelled the only red one. */
export const ORDER_STATUS_BADGE = {
	booked: "info",
	shipped: "secondary",
	invoiced: "warning",
	paid: "success",
	cancelled: "destructive",
} satisfies Record<OrderStatus, BadgeVariant>;

/**
 * The status of an order that is `ageDays` old. An order ships after 1 day, gets its invoice
 * after 8 days, and is paid after 30 days. `delayDays` (0 to 2) adds a delay to each step.
 */
export function orderStatusOf(order: {
	isCancelled: boolean;
	ageDays: number;
	delayDays: number;
}): OrderStatus {
	if (order.isCancelled) {
		return "cancelled";
	}
	if (order.ageDays < 1 + order.delayDays) {
		return "booked";
	}
	if (order.ageDays < 8 + order.delayDays) {
		return "shipped";
	}
	if (order.ageDays < 30 + order.delayDays * 3) {
		return "invoiced";
	}
	return "paid";
}
