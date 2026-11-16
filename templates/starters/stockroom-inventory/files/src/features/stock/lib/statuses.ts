// The status words of the stockroom and the Badge variant of each: stock levels, purchase orders, and movements.
// The badges, the list tabs, the search params, and the sample simulation read these lists.
// A real database repeats each list in a check constraint (STARTER.md).
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Stock levels, the most urgent first. The item list sorts and tabs in this order. */
export const STOCK_STATUSES = ["out", "low", "ok"] as const;

/** One stock level. Its label is the message key `stockStatuses.<status>`. */
export type StockStatus = (typeof STOCK_STATUSES)[number];

/** Badge per stock level. Out of stock is the only red one. */
export const STOCK_STATUS_BADGE = {
	out: "destructive",
	low: "warning",
	ok: "success",
} satisfies Record<StockStatus, BadgeVariant>;

/**
 * The stock level of an item. Low is under the minimum, the reorder point of the item.
 * An item at exactly its minimum is still in stock: the reorder starts under it.
 */
export function stockStatusOf(onHand: number, minimum: number): StockStatus {
	if (onHand <= 0) {
		return "out";
	}
	return onHand < minimum ? "low" : "ok";
}

/** Purchase order statuses, in the order of the work. The tabs follow this order. */
export const PURCHASE_ORDER_STATUSES = [
	"draft",
	"ordered",
	"partly_received",
	"received",
	"cancelled",
] as const;

/** One purchase order status. Its label is the message key `orderStatuses.<status>`. */
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/** Badge per purchase order status. A late order gets a second, red badge. */
export const PURCHASE_ORDER_STATUS_BADGE = {
	draft: "secondary",
	ordered: "info",
	partly_received: "warning",
	received: "success",
	cancelled: "outline",
} satisfies Record<PurchaseOrderStatus, BadgeVariant>;

/** True while goods are still to come: the order went to the supplier and not every unit arrived. */
export function isOpenOrderStatus(status: PurchaseOrderStatus): boolean {
	return status === "ordered" || status === "partly_received";
}

/** The kinds of stock movement. Each movement changes the on-hand quantity of one item. */
export const MOVEMENT_REASONS = [
	"receipt",
	"pick",
	"adjustment",
	"damage",
] as const;

/** One kind of movement. Its label is the message key `movementReasons.<reason>`. */
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/** Badge per movement kind. Receipts add stock; picks are the normal flow out. */
export const MOVEMENT_REASON_BADGE = {
	receipt: "success",
	pick: "secondary",
	adjustment: "info",
	damage: "destructive",
} satisfies Record<MovementReason, BadgeVariant>;
