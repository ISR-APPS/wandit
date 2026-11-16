// Reads of the box office home: the KPI rows, the daily revenue, and the next events.
// The loader of the home route prefetches them. OverviewPage reads them from the cache.
// Each queryFn reads the sample box office. A later turn replaces each body with a Supabase rpc call.
import { queryOptions } from "@tanstack/react-query";
import { loadBoxOffice } from "~/features/organiser";
import {
	buildOverviewKpis,
	dailyRevenue,
	todaySales,
} from "../lib/overview-math";

/** How many events the "Next events" list shows. */
export const NEXT_EVENTS_COUNT = 6;

/** The four KPI rows of the facts row, over the last 30 days. The key has no period. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => buildOverviewKpis(loadBoxOffice(Date.now())),
	});
}

/** Ticket revenue per day for the last `days` full days, with the same days one period earlier. Feeds the hero. */
export function dailyRevenueQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["ticket-sales", "daily-revenue", days],
		queryFn: async () => dailyRevenue(loadBoxOffice(Date.now()), days),
	});
}

/** The revenue and the order count of today until now. The hero shows it beside the full days. */
export function todaySalesQueryOptions() {
	return queryOptions({
		queryKey: ["ticket-sales", "today"],
		queryFn: async () => todaySales(loadBoxOffice(Date.now())),
	});
}

/** The events that have not ended and are not cancelled, the soonest first: a live event leads the list. */
export function nextEventsQueryOptions() {
	return queryOptions({
		queryKey: ["events", "next"],
		queryFn: async () => {
			const box = loadBoxOffice(Date.now());
			return box.events
				.filter(
					(event) => event.endsAt > box.now && event.status !== "cancelled",
				)
				.slice(0, NEXT_EVENTS_COUNT);
		},
	});
}
