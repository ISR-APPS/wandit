// Read of the totals of today against the same weekday last week at this time.
// The sales home, the menu page, and the day report read it, so their deltas compare the same totals.
// The queryFn builds on the sample checks and history. A SQL read function that groups `orders` by day can replace it.
import { queryOptions } from "@tanstack/react-query";
import { sameTimeLastWeek, totalsOfToday } from "../lib/day-totals";
import { listDailyHistory } from "../lib/sample-history";
import { listOrders, plannedDayTotals } from "../lib/sample-orders";
import { LIVE_REFETCH_MS } from "./orders.queries";

/** Today so far and the same weekday last week at this time. lastWeek is undefined with under a week of history. */
export function dayTotalsQueryOptions() {
	return queryOptions({
		queryKey: ["orders", "day-totals"],
		queryFn: async () => {
			const now = Date.now();
			const plannedDay = plannedDayTotals();
			const today = totalsOfToday(listOrders(now));
			return {
				today,
				lastWeek: sameTimeLastWeek(
					listDailyHistory(now, plannedDay),
					today,
					plannedDay,
				),
			};
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
