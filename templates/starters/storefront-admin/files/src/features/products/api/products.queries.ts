// Reads of products: the catalog with its sales and stock figures, and the sales record of one product.
// The loader of the product route prefetches the catalog. The product dialog reads the sales record after a click.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	buildDailySeries,
	calendarDaysFromNow,
	countsAsRevenue,
	type DailyPoint,
	getSampleTables,
	type OrderStatus,
	type ProductCategory,
	type SampleTables,
} from "~/features/shop";
import { coverDaysOf, type StockLevel, stockLevelOf } from "../lib/stock";

/** The sales figures of the product pages cover this count of full days. */
export const SALES_DAYS = 30;

/** One product with its sales and stock figures. */
export type Product = {
	id: string;
	name: string;
	/** The stock keeping unit, for example "PAN-OIL-500". */
	sku: string;
	category: ProductCategory;
	/** The price of one unit, in the app currency. */
	price: number;
	/** Units on the shelf now. */
	stock: number;
	/** The shop orders more units when `stock` is at or under this number. */
	reorderPoint: number;
	stockLevel: StockLevel;
	/** Units sold in the last SALES_DAYS days, in orders that count as revenue. */
	soldUnits: number;
	/** The days that the stock lasts at that sales speed. null when nothing sold. */
	coverDays: number | null;
};

/** One order that holds a product, for the product dialog. */
export type ProductOrder = {
	orderId: string;
	placedAt: string;
	status: OrderStatus;
	customerName: string;
	/** Units of this product in the order. */
	quantity: number;
};

/** The sales record of one product. */
export type ProductSales = {
	/** Units sold per day for the last SALES_DAYS days, oldest first. */
	unitsPerDay: DailyPoint[];
	/** Units sold since the shop opened, in orders that count as revenue. */
	lifetimeUnits: number;
	/** The newest orders with this product, at most 5. */
	recentOrders: ProductOrder[];
};

// The status and the time of each order, by id. The lines join it to count the sales.
function ordersById(tables: SampleTables) {
	return new Map(tables.orders.map((order) => [order.id, order]));
}

/** Every product of the catalog, in catalog order. The page filters and sorts them. */
export function productsQueryOptions() {
	return queryOptions({
		queryKey: ["products", "list"],
		queryFn: async (): Promise<Product[]> => {
			const tables = getSampleTables();
			const orders = ordersById(tables);
			const soldUnits = new Map<string, number>();
			for (const line of tables.orderLines) {
				const order = orders.get(line.orderId);
				if (
					order &&
					countsAsRevenue(order.status) &&
					-calendarDaysFromNow(order.placedAt, tables.dayStart) <= SALES_DAYS
				) {
					soldUnits.set(
						line.productId,
						(soldUnits.get(line.productId) ?? 0) + line.quantity,
					);
				}
			}
			return tables.products.map((product) => {
				const sold = soldUnits.get(product.id) ?? 0;
				return {
					...product,
					stockLevel: stockLevelOf(product.stock, product.reorderPoint),
					soldUnits: sold,
					coverDays: coverDaysOf(product.stock, sold, SALES_DAYS),
				};
			});
		},
	});
}

/** The sales record of one product: units per day, units since the opening, and the newest orders. */
export function productSalesQueryOptions(productId: string) {
	return queryOptions({
		queryKey: ["products", "sales", productId],
		queryFn: async (): Promise<ProductSales> => {
			const tables = getSampleTables();
			const orders = ordersById(tables);
			const customers = new Map(
				tables.customers.map((customer) => [customer.id, customer.name]),
			);
			const productOrders = tables.orderLines.flatMap((line) => {
				const order = orders.get(line.orderId);
				return line.productId === productId && order
					? [
							{
								orderId: order.id,
								placedAt: order.placedAt,
								status: order.status,
								customerName: customers.get(order.customerId) ?? "",
								quantity: line.quantity,
							},
						]
					: [];
			});
			const sold = productOrders.filter((order) =>
				countsAsRevenue(order.status),
			);
			return {
				unitsPerDay: buildDailySeries(
					sold.map((order) => ({
						occurredAt: order.placedAt,
						value: order.quantity,
					})),
					SALES_DAYS,
					tables.dayStart,
				),
				lifetimeUnits: sold.reduce((sum, order) => sum + order.quantity, 0),
				recentOrders: productOrders
					.sort((first, second) =>
						second.placedAt.localeCompare(first.placedAt),
					)
					// 5 rows fit the dialog on a laptop screen with no scroll.
					.slice(0, 5),
			};
		},
	});
}
