// Reads of the statistics of the floor page: the 2 KPI figures and the checks per day of the heat calendar.
// The /app loader prefetches both. FloorPage and OrdersHeatPanel read them.
// Each queryFn builds on the sample orders and history of ~/features/restaurant. A SQL read function can replace it.
import { queryOptions } from "@tanstack/react-query";
import {
	LIVE_REFETCH_MS,
	listDailyHistory,
	listOrders,
	plannedDayTotals,
} from "~/features/restaurant";
import {
	buildDailyChecks,
	buildFloorKpis,
	sameTimeLastWeek,
	totalsOfToday,
} from "../lib/series";

/** Covers and sales of today against the same weekday last week at this time. It refetches every 30 s. The key has no period. */
export function floorKpisQueryOptions() {
	return queryOptions({
		queryKey: ["floor", "kpis"],
		queryFn: async () => {
			const now = Date.now();
			const plannedDay = plannedDayTotals();
			const history = listDailyHistory(now, plannedDay);
			const today = totalsOfToday(listOrders(now));
			return buildFloorKpis(
				today,
				sameTimeLastWeek(history, today, plannedDay),
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** Checks per day for the last `days` days, today included. Feeds the heat calendar. */
export function dailyChecksQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["orders", "daily", days],
		queryFn: async () => {
			const now = Date.now();
			return buildDailyChecks(
				listDailyHistory(now, plannedDayTotals()),
				totalsOfToday(listOrders(now)),
				now,
				days,
			);
		},
	});
}
