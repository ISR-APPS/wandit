// Reads of customers: every customer with the order count, the amount spent, and the segment.
// The loader of the customer route prefetches the list. The customer table and the customer panel read it from the cache.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { countsAsRevenue, getSampleTables } from "~/features/shop";
import { type CustomerSegment, segmentOf } from "../lib/segment";

/** One customer with the figures that the list shows. The times are ISO texts. */
export type Customer = {
	id: string;
	name: string;
	email: string;
	/** The street line of the delivery address. */
	street: string;
	city: string;
	/** The region code of the address, for example "OR". */
	region: string;
	postalCode: string;
	/** The time of the first order. */
	joinedAt: string;
	/** The count of every order of the customer, in every status. */
	orderCount: number;
	/** The sum of the orders that count as revenue, in the app currency. */
	spent: number;
	/** The time of the newest order. */
	lastOrderAt: string;
	segment: CustomerSegment;
};

/** Every customer, the newest order first. The page filters, sorts, and pages them. */
export function customersQueryOptions() {
	return queryOptions({
		queryKey: ["customers", "list"],
		queryFn: async (): Promise<Customer[]> => {
			const tables = getSampleTables();
			const figures = new Map<
				string,
				{ orderCount: number; spent: number; lastOrderAt: string }
			>();
			// The order rows are in time order, so the last write per customer is the newest order.
			for (const order of tables.orders) {
				const current = figures.get(order.customerId);
				figures.set(order.customerId, {
					orderCount: (current?.orderCount ?? 0) + 1,
					spent:
						(current?.spent ?? 0) +
						(countsAsRevenue(order.status) ? order.total : 0),
					lastOrderAt: order.placedAt,
				});
			}
			// LIMIT: every customer in one read, paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
			return tables.customers
				.map((customer) => {
					const own = figures.get(customer.id) ?? {
						orderCount: 0,
						spent: 0,
						lastOrderAt: customer.joinedAt,
					};
					return {
						...customer,
						...own,
						segment: segmentOf(
							{ joinedAt: customer.joinedAt, ...own },
							tables.dayStart,
						),
					};
				})
				.sort((first, second) =>
					second.lastOrderAt.localeCompare(first.lastOrderAt),
				);
		},
	});
}
