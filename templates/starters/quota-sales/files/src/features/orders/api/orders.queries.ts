// Reads of orders: every order of the last 90 days, newest first.
// The orders route and the home route prefetch it. The orders page and the newest orders panel read it from the cache.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	getSampleTables,
	type Order,
	todayDayNumber,
	toOrders,
} from "~/features/sales";

/** The orders page covers this many closed days. */
export const ORDERS_DAYS = 90;

/** Every order booked in the last ORDERS_DAYS days, newest first. The page searches, sorts, and pages them in the browser. */
export function ordersQueryOptions() {
	return queryOptions({
		queryKey: ["orders", "list", ORDERS_DAYS],
		queryFn: async (): Promise<Order[]> => {
			const tables = getSampleTables(todayDayNumber());
			const firstDay = tables.today - ORDERS_DAYS;
			return toOrders(
				tables.orders.filter((order) => order.day >= firstDay),
				tables,
			);
		},
	});
}
