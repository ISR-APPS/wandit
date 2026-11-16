// The statuses of an order, its delivery and payment choices, and the Badge variant of each status.
// The sample tables, the order pages, the home list, and the customer panel read this file.
// A later orders table keeps the same values as check constraints.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of the work. The tabs of the order list follow this order. */
export const ORDER_STATUSES = [
	"to_ship",
	"shipped",
	"delivered",
	"refunded",
	"cancelled",
] as const;

/** One status. Its label is the message key `orders.statuses.<status>`. */
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** One variant of the kit Badge. The status, stage, stock, and segment maps of the app check their values against it. */
export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

/** Badge variant per status. Delivered is the only green one. Refunded and cancelled are end states with no color: an outline shows on every surface. */
export const ORDER_STATUS_BADGE = {
	to_ship: "warning",
	shipped: "info",
	delivered: "success",
	refunded: "outline",
	cancelled: "outline",
} satisfies Record<OrderStatus, BadgeVariant>;

/** The delivery choices of the checkout. Its label is the message key `orders.shipping.<method>`. */
export const SHIPPING_METHODS = ["standard", "express"] as const;

/** One delivery choice. Express costs more and ships first. */
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

/** How the customer paid. Its label is the message key `orders.payment.<method>`. */
export const PAYMENT_METHODS = ["card", "wallet", "bank_transfer"] as const;

/** One payment method. Every sample order is paid at checkout. */
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A standard order ships within this count of days. An order that waits longer is late. */
export const SHIP_TARGET_DAYS = 2;

/**
 * Product rule: an order counts as revenue unless it is cancelled or refunded.
 * The home figures, the product sales, and the amount that a customer spent use this one rule.
 */
export function countsAsRevenue(status: OrderStatus): boolean {
	return status !== "cancelled" && status !== "refunded";
}
