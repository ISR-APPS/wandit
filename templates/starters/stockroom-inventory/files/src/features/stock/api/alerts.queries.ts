// Reads of the header alerts: the items out of stock or under their reorder point, and the late purchase orders.
// HeaderNotifications reads it after the shell renders. The rules come from statuses.ts and orders.ts,
// so the bell counts the same items as the "Low" and "Out of stock" filters of the item list.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { lateDaysOf } from "../lib/orders";
import { getSampleTables } from "../lib/sample-data";
import { stockStatusOf } from "../lib/statuses";

// An item alert opens the item page. linkOptions types the path, so a wrong path fails typecheck.
function itemLink(itemId: string) {
	return linkOptions({ to: "/app/items/$itemId", params: { itemId } });
}

// An order alert opens the order panel of the order list.
function orderLink(orderId: string) {
	return linkOptions({ to: "/app/purchase-orders", search: { po: orderId } });
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "outOfStock": nothing on the shelf. "lateOrder": an open order past its expected day. "lowStock": under the reorder point. */
	kind: "outOfStock" | "lateOrder" | "lowStock";
	/** The item name or the order number. */
	title: string;
	/** The SKU of the item, or the supplier of the order. */
	detail: string;
	/** ISO time: the last movement of the item, or the expected day of the order. */
	at: string;
	link: ReturnType<typeof itemLink> | ReturnType<typeof orderLink>;
};

// The bell shows the most urgent kind first: an empty shelf stops the picks, a late order delays the refill.
const KIND_ORDER: Alert["kind"][] = ["outOfStock", "lateOrder", "lowStock"];

/** Every alert, the most urgent kind first and the oldest first inside a kind. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const tables = getSampleTables();
			const supplierName = new Map(
				tables.suppliers.map((supplier) => [supplier.id, supplier.name]),
			);
			const lastMovementAt = new Map<string, string>();
			// Movements are newest first, so the first one seen per item is its newest.
			for (const movement of tables.movements) {
				if (!lastMovementAt.has(movement.itemId)) {
					lastMovementAt.set(movement.itemId, movement.occurredAt);
				}
			}
			const itemAlerts: Alert[] = tables.items.flatMap((item) => {
				const status = stockStatusOf(item.onHand, item.minimum);
				if (status === "ok") {
					return [];
				}
				return [
					{
						id: item.id,
						kind: status === "out" ? "outOfStock" : "lowStock",
						title: item.name,
						detail: item.sku,
						at:
							lastMovementAt.get(item.id) ??
							new Date(tables.todayStart).toISOString(),
						link: itemLink(item.id),
					},
				];
			});
			const orderAlerts: Alert[] = tables.purchaseOrders
				.filter((order) => lateDaysOf(order, tables.todayStart) > 0)
				.map((order) => ({
					id: order.id,
					kind: "lateOrder",
					title: order.number,
					detail: supplierName.get(order.supplierId) ?? "",
					at: order.expectedOn,
					link: orderLink(order.id),
				}));
			return [...itemAlerts, ...orderAlerts].sort(
				(first, second) =>
					KIND_ORDER.indexOf(first.kind) - KIND_ORDER.indexOf(second.kind) ||
					first.at.localeCompare(second.at),
			);
		},
	});
}
