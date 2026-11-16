// Reads of orders: the list, one order with its lines and its customer, and the orders of one customer.
// The route loaders prefetch them. The home list, the order pages, and the customer panel read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	getSampleTables,
	type OrderLineRow,
	type OrderRow,
	type OrderStatus,
	type PaymentMethod,
	type ProductCategory,
	type SampleTables,
	type ShippingMethod,
} from "~/features/shop";

/** One order with the names that a list shows. The times are ISO texts. */
export type Order = {
	/** The order number as text, for example "1042". Also the `$orderId` of the detail route. */
	id: string;
	status: OrderStatus;
	placedAt: string;
	/** When the team packed the parcel. null while the order waits on the shelf. */
	packedAt: string | null;
	shippingMethod: ShippingMethod;
	/** What the customer paid, in the app currency. */
	total: number;
	/** The sum of the quantities of every line. */
	unitCount: number;
	/** The count of lines: one line is one product. */
	lineCount: number;
	/** The name of the product of the first line, for a one-line summary. */
	firstProductName: string;
	customerId: string;
	customerName: string;
	/** The city and the region code of the delivery address, for example "Portland, OR". */
	customerPlace: string;
};

/** One line of an order with the product facts that the order page shows. */
export type OrderLine = {
	id: string;
	/** The id of the product row. The product page opens its dialog with it. */
	productId: string;
	productName: string;
	sku: string;
	category: ProductCategory;
	quantity: number;
	/** The price of one unit at the time of the order. */
	unitPrice: number;
};

/** One order with the records that only its own page shows. */
export type OrderDetail = Order & {
	/** The sum of the lines before the discount and the delivery fee. */
	subtotal: number;
	/** The code that the customer typed at checkout, or null. */
	discountCode: string | null;
	discount: number;
	shippingFee: number;
	paymentMethod: PaymentMethod;
	shippedAt: string | null;
	deliveredAt: string | null;
	cancelledAt: string | null;
	refundedAt: string | null;
	/** The carrier number of the parcel. null before the parcel leaves. */
	trackingNumber: string | null;
	/** A message of the customer from the checkout, or null. */
	note: string | null;
	lines: OrderLine[];
	customer: {
		email: string;
		/** The street line of the delivery address. */
		street: string;
		postalCode: string;
		/** The count of every order of this customer, this one included. */
		orderCount: number;
	};
	/** The other orders of the same customer, newest first, at most 5. */
	otherOrders: Order[];
};

// Groups the lines by order id in one pass. A database join does this later.
function linesByOrder(tables: SampleTables): Map<string, OrderLineRow[]> {
	const groups = new Map<string, OrderLineRow[]>();
	for (const line of tables.orderLines) {
		const group = groups.get(line.orderId);
		if (group) {
			group.push(line);
		} else {
			groups.set(line.orderId, [line]);
		}
	}
	return groups;
}

// Adds the customer and the line summary to order rows, and puts the newest order first.
function withNames(rows: OrderRow[], tables: SampleTables): Order[] {
	const customers = new Map(tables.customers.map((row) => [row.id, row]));
	const products = new Map(tables.products.map((row) => [row.id, row]));
	const lines = linesByOrder(tables);
	return rows
		.map((row) => {
			const customer = customers.get(row.customerId);
			const orderLines = lines.get(row.id) ?? [];
			return {
				id: row.id,
				status: row.status,
				placedAt: row.placedAt,
				packedAt: row.packedAt,
				shippingMethod: row.shippingMethod,
				total: row.total,
				unitCount: orderLines.reduce((sum, line) => sum + line.quantity, 0),
				lineCount: orderLines.length,
				firstProductName:
					products.get(orderLines[0]?.productId ?? "")?.name ?? "",
				customerId: row.customerId,
				customerName: customer?.name ?? "",
				customerPlace: customer ? `${customer.city}, ${customer.region}` : "",
			};
		})
		.sort((first, second) => second.placedAt.localeCompare(first.placedAt));
}

/** Every order, the newest first. The list page filters, sorts, and pages them; the home shows the ones to ship. */
export function ordersQueryOptions() {
	return queryOptions({
		queryKey: ["orders", "list"],
		queryFn: async () => {
			const tables = getSampleTables();
			// LIMIT: every order in one read, paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
			return withNames(tables.orders, tables);
		},
	});
}

/** The orders of one customer, the newest first. The customer panel lists them. */
export function customerOrdersQueryOptions(customerId: string) {
	return queryOptions({
		queryKey: ["orders", "customer", customerId],
		queryFn: async () => {
			const tables = getSampleTables();
			return withNames(
				tables.orders.filter((order) => order.customerId === customerId),
				tables,
			);
		},
	});
}

/** One order with its lines, its customer, and the other orders of that customer. null when the id does not exist. */
export function orderQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["orders", "detail", id],
		queryFn: async (): Promise<OrderDetail | null> => {
			const tables = getSampleTables();
			const row = tables.orders.find((order) => order.id === id);
			const customer = tables.customers.find(
				(person) => person.id === row?.customerId,
			);
			// The id comes from the URL. An unknown id is "not found", not an error.
			if (!row || !customer) {
				return null;
			}
			const customerOrders = withNames(
				tables.orders.filter((order) => order.customerId === customer.id),
				tables,
			);
			const order = customerOrders.find((item) => item.id === id);
			if (!order) {
				return null;
			}
			const products = new Map(tables.products.map((item) => [item.id, item]));
			return {
				...order,
				subtotal: row.subtotal,
				discountCode: row.discountCode,
				discount: row.discount,
				shippingFee: row.shippingFee,
				paymentMethod: row.paymentMethod,
				shippedAt: row.shippedAt,
				deliveredAt: row.deliveredAt,
				cancelledAt: row.cancelledAt,
				refundedAt: row.refundedAt,
				trackingNumber: row.trackingNumber,
				note: row.note,
				lines: tables.orderLines.flatMap((line) => {
					const product = products.get(line.productId);
					return line.orderId === id && product
						? [
								{
									id: line.id,
									productId: line.productId,
									productName: product.name,
									sku: product.sku,
									category: product.category,
									quantity: line.quantity,
									unitPrice: line.unitPrice,
								},
							]
						: [];
				}),
				customer: {
					email: customer.email,
					street: customer.street,
					postalCode: customer.postalCode,
					orderCount: customerOrders.length,
				},
				otherOrders: customerOrders
					.filter((item) => item.id !== id)
					// 5 rows fill the side card and stay shorter than the main column.
					.slice(0, 5),
			};
		},
	});
}
