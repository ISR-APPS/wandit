// The stock rules of a product: its level against the reorder point, and the days that the stock lasts.
// The product queries call them. The product table, the restock card, and the product dialog show the results.
import type { BadgeVariant } from "~/features/shop";

/** Every stock level, the best first. The tabs of the product list follow this order. */
export const STOCK_LEVELS = ["in_stock", "low", "out"] as const;

/** One stock level. Its label is the message key `products.levels.<level>`. */
export type StockLevel = (typeof STOCK_LEVELS)[number];

/** Badge variant per level. Out of stock is the only red one. */
export const STOCK_LEVEL_BADGE = {
	in_stock: "success",
	low: "warning",
	out: "destructive",
} satisfies Record<StockLevel, BadgeVariant>;

/** Track and bar colors of the stock bar per level, on the Progress root. The bar of an in-stock product stays ink. */
export const STOCK_LEVEL_BAR = {
	in_stock: "",
	low: "bg-warning/15 *:data-[slot=progress-indicator]:bg-warning",
	out: "bg-destructive/15 *:data-[slot=progress-indicator]:bg-destructive",
} satisfies Record<StockLevel, string>;

/** Product rule: a product is low when its stock is at or under its reorder point. */
export function stockLevelOf(stock: number, reorderPoint: number): StockLevel {
	if (stock <= 0) {
		return "out";
	}
	return stock <= reorderPoint ? "low" : "in_stock";
}

/**
 * The days that `stock` lasts at the sales speed of the last `days` days.
 * null when nothing sold in the period: the stock then has no end date.
 */
export function coverDaysOf(
	stock: number,
	soldUnits: number,
	days: number,
): number | null {
	return soldUnits === 0 ? null : stock / (soldUnits / days);
}
