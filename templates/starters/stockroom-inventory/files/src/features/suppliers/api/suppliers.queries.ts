// Reads of suppliers: each supplier with its families, its open orders, and its delivery record.
// The /app/suppliers route prefetches the list. The supplier cards and the supplier panel read it.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	addLocalDays,
	deliveryDelayDays,
	getSampleTables,
	isDeliveredOnTime,
	isOpenOrderStatus,
	lateDaysOf,
	STOCK_CATEGORIES,
	type StockCategory,
	type SupplierRow,
	stockStatusOf,
} from "~/features/stock";

// The ordered value covers the same 90 days as the longest chart period.
const VALUE_DAYS = 90;

/** One supplier row (its id is the URL id of the supplier panel) with its delivery record. */
export type Supplier = SupplierRow & {
	/** The families of the items that it supplies, in the order of STOCK_CATEGORIES. */
	categories: StockCategory[];
	itemCount: number;
	/** Its items under their minimum now, out of stock included. */
	itemsBelowMinimum: number;
	/** Sent orders that still wait for goods. */
	openOrders: number;
	/** Open orders past their expected day. */
	lateOrders: number;
	/** Orders delivered in full over the history. The on-time rate counts these. */
	deliveredOrders: number;
	/** Share of delivered orders with the last delivery on or before the expected day. null with no delivery. */
	onTimeRate: number | null;
	/** Mean days late of the delivered orders that came late. null when none came late. */
	averageDelayDays: number | null;
	/** Value of the orders sent in the last 90 days, cancelled orders excluded, in whole units of the stock currency. */
	orderedValue: number;
};

/** Every supplier, in the order of the catalog. The page sorts them. */
export function suppliersQueryOptions() {
	return queryOptions({
		queryKey: ["suppliers", "list"],
		queryFn: async (): Promise<Supplier[]> => {
			const tables = getSampleTables();
			const valueStart = addLocalDays(tables.todayStart, -VALUE_DAYS);
			return tables.suppliers.map((supplier) => {
				const items = tables.items.filter(
					(item) => item.supplierId === supplier.id,
				);
				const orders = tables.purchaseOrders.filter(
					(order) => order.supplierId === supplier.id,
				);
				const delivered = orders.filter((order) => order.status === "received");
				const lateDelays = delivered
					.map((order) => deliveryDelayDays(order) ?? 0)
					.filter((delay) => delay > 0);
				const open = orders.filter((order) => isOpenOrderStatus(order.status));
				return {
					...supplier,
					categories: STOCK_CATEGORIES.filter((category) =>
						items.some((item) => item.category === category),
					),
					itemCount: items.length,
					itemsBelowMinimum: items.filter(
						(item) => stockStatusOf(item.onHand, item.minimum) !== "ok",
					).length,
					openOrders: open.length,
					lateOrders: open.filter(
						(order) => lateDaysOf(order, tables.todayStart) > 0,
					).length,
					deliveredOrders: delivered.length,
					onTimeRate:
						delivered.length === 0
							? null
							: delivered.filter(isDeliveredOnTime).length / delivered.length,
					averageDelayDays:
						lateDelays.length === 0
							? null
							: lateDelays.reduce((sum, delay) => sum + delay, 0) /
								lateDelays.length,
					// Whole units: the cards show whole amounts, so the page total equals the sum of the cards.
					orderedValue: Math.round(
						orders
							.filter(
								(order) =>
									order.status !== "cancelled" &&
									order.orderedAt !== null &&
									Date.parse(order.orderedAt) >= valueStart,
							)
							.reduce(
								(sum, order) =>
									sum +
									order.lines.reduce(
										(lineSum, line) =>
											lineSum + line.quantityOrdered * line.unitCost,
										0,
									),
								0,
							),
					),
				};
			});
		},
	});
}
