// Reads of the box office home: the summary of one period, and the newest orders.
// The loader of the home route prefetches them. OverviewPage reads them from the cache.
// Each queryFn reads the sample box office. A later turn replaces each body with a Supabase rpc call.
import { queryOptions } from "@tanstack/react-query";
import { loadBoxOffice, type Order } from "~/features/organiser";
import { buildHomeSummary } from "../lib/overview-math";

/** How many orders the "Recent orders" card lists. 4 rows keep it level with the cards beside it. */
const RECENT_ORDERS_COUNT = 4;

/** One order of the feed, with the name of its event. */
export type RecentOrder = Order & { eventName: string };

/** The KPIs, the charts, and the venue loads of the last `days` days. The period is in the key. */
export function homeSummaryQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", "summary", days],
		queryFn: async () => buildHomeSummary(loadBoxOffice(Date.now()), days),
	});
}

/** The newest orders of every event, the newest first. Refunded orders show too, with their badge. */
export function recentOrdersQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "recent-orders"],
		queryFn: async (): Promise<RecentOrder[]> => {
			const box = loadBoxOffice(Date.now());
			const names = new Map(box.events.map((event) => [event.id, event.name]));
			return [...box.orders]
				.sort((first, second) => second.placedAt - first.placedAt)
				.slice(0, RECENT_ORDERS_COUNT)
				.map((order) => ({
					...order,
					eventName: names.get(order.eventId) ?? "",
				}));
		},
	});
}
