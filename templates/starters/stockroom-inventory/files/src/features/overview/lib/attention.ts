// The attention rule of the home: the items and the orders that need a person today.
// NeedsAttentionCard renders the rows. The rule reads the item list and the order list of the cache.
import type { StockItem } from "~/features/items";
import type { PurchaseOrder } from "~/features/purchase-orders";

/** One row of the attention list: an item under its minimum, or an order past its expected day. */
export type AttentionRow =
	| {
			kind: "item";
			item: StockItem;
	  }
	| {
			kind: "order";
			order: PurchaseOrder;
	  };

/**
 * Every row that needs a person, the most urgent first: items out of stock, then late orders
 * (the latest first), then low items (the shortest cover first).
 */
export function buildAttentionRows(
	items: StockItem[],
	orders: PurchaseOrder[],
): AttentionRow[] {
	// LIMIT: reads the newest 1,000 rows. Upgrade: a query of the open rows by due date.
	const byCover = (first: StockItem, second: StockItem) =>
		(first.daysOfCover ?? Number.POSITIVE_INFINITY) -
		(second.daysOfCover ?? Number.POSITIVE_INFINITY);
	const out = items.filter((item) => item.status === "out").sort(byCover);
	const low = items.filter((item) => item.status === "low").sort(byCover);
	const late = orders
		.filter((order) => order.lateDays > 0)
		.sort((first, second) => second.lateDays - first.lateDays);
	return [
		...out.map((item) => ({ kind: "item" as const, item })),
		...late.map((order) => ({ kind: "order" as const, order })),
		...low.map((item) => ({ kind: "item" as const, item })),
	];
}
