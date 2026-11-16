// Reads of the menu: every dish and drink with its price and its availability now.
// The menu page, the order screen, and their route loaders read it.
// The queryFn returns the sample rows of sample-menu.ts. To make it real, replace its body with a Supabase select.
import { queryOptions } from "@tanstack/react-query";
import { listMenuItemsAt } from "../lib/sample-menu";
import { businessDay } from "../lib/sample-orders";
import { LIVE_REFETCH_MS } from "./orders.queries";

/** Every menu item in the order of the printed menu. It refetches every 30 s, because a dish can sell out. */
export function menuQueryOptions() {
	return queryOptions({
		queryKey: ["menu", "items"],
		queryFn: async () => listMenuItemsAt(businessDay(Date.now()).minute),
		refetchInterval: LIVE_REFETCH_MS,
	});
}
