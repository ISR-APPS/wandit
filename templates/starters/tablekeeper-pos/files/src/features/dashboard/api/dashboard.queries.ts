// Read of the sales home: the daily sales of the chosen period, for the chart card and the header download.
// The /app loader prefetches the first period. SalesChartCard and DashboardPage read it.
// Each queryFn builds on the sample checks and history of ~/features/restaurant. A SQL read function can replace it.
import { queryOptions } from "@tanstack/react-query";
import {
	businessDay,
	LIVE_REFETCH_MS,
	listDailyHistory,
	listOrders,
	plannedDayTotals,
	totalsOfToday,
} from "~/features/restaurant";
import { buildSalesByDay, type PeriodDays } from "../lib/dashboard";

/** Sales and covers per day for the last `days` days, today included. The period is in the key. */
export function salesByDayQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["dashboard", "sales-by-day", days],
		queryFn: async () => {
			const now = Date.now();
			return buildSalesByDay(
				listDailyHistory(now, plannedDayTotals()),
				totalsOfToday(listOrders(now)),
				businessDay(now).start,
				days,
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
