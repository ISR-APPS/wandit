// Reads of the header alerts: the late orders, the oldest first, then the products that are out of stock.
// HeaderNotifications reads it after the shell renders. The rules come from lib/order-progress.ts and lib/stock.ts,
// so the bell counts the same orders as the "Late" filter of the order list, and the same products as "Out of stock".
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { shelfStageOf } from "../lib/order-progress";
import { getSampleTables } from "../lib/sample-data";
import { stockLevelOf } from "../lib/stock";

// A late order opens its page. linkOptions types the path, so a wrong path fails typecheck.
function orderLink(orderId: string) {
	return linkOptions({ to: "/app/orders/$orderId", params: { orderId } });
}

// A product opens its dialog on the product list.
function productLink(productId: string) {
	return linkOptions({ to: "/app/products", search: { product: productId } });
}

/** One alert of the bell menu. */
export type Alert = {
	/** The order number or the product id. */
	id: string;
	/** "lateOrder": an order to ship past its ship date. "outOfStock": a product with no unit on the shelf. */
	kind: "lateOrder" | "outOfStock";
	/** The order number with "#", or the product name. */
	title: string;
	/** The customer of the order, or the SKU of the product. */
	detail: string;
	/** ISO time of the order. null for a product: the sample stock has no time of change. */
	at: string | null;
	link: ReturnType<typeof orderLink> | ReturnType<typeof productLink>;
};

/** Every alert: the late orders, the oldest first, then the products out of stock. The bell shows the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const tables = getSampleTables();
			const now = Date.now();
			const customers = new Map(
				tables.customers.map((customer) => [customer.id, customer.name]),
			);
			const lateOrders: Alert[] = tables.orders
				.filter((order) => shelfStageOf(order, now) === "late")
				.sort((first, second) => first.placedAt.localeCompare(second.placedAt))
				.map((order) => ({
					id: order.id,
					kind: "lateOrder",
					title: `#${order.id}`,
					detail: customers.get(order.customerId) ?? "",
					at: order.placedAt,
					link: orderLink(order.id),
				}));
			const emptyShelves: Alert[] = tables.products
				.filter(
					(product) =>
						stockLevelOf(product.stock, product.reorderPoint) === "out",
				)
				.map((product) => ({
					id: product.id,
					kind: "outOfStock",
					title: product.name,
					detail: product.sku,
					at: null,
					link: productLink(product.id),
				}));
			return [...lateOrders, ...emptyShelves];
		},
	});
}
