// Reads of the checks of the business day: the list and one check by its number.
// The orders pages, the floor, the menu, and the day report read them, so their numbers agree.
// Each queryFn returns the sample rows of sample-orders.ts. To make it real, replace its body with a Supabase select.
import { queryOptions } from "@tanstack/react-query";
import { listOrders } from "../lib/sample-orders";

/** 30 s. A check changes its status during the service: sent, served, bill, paid. */
export const LIVE_REFETCH_MS = 30_000;

/** Every check of the business day, newest first. It refetches every 30 s. */
export function ordersQueryOptions() {
	return queryOptions({
		queryKey: ["orders", "list"],
		queryFn: async () => listOrders(Date.now()),
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** One check by its number, or null when the number is not a check of the day. It refetches with the list. */
export function orderQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["orders", "detail", id],
		queryFn: async () =>
			listOrders(Date.now()).find((order) => order.id === id) ?? null,
		refetchInterval: LIVE_REFETCH_MS,
	});
}
