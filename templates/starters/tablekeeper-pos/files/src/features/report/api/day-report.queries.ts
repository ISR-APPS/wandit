// Read of the day report: the figures and the breakdowns of the business day so far.
// The /app/report loader prefetches it. ReportPage and its cards read it.
// The queryFn builds on the sample orders and history of ~/features/restaurant. A SQL read function can replace it.
import { queryOptions } from "@tanstack/react-query";
import {
	LIVE_REFETCH_MS,
	listDailyHistory,
	listOrders,
	plannedDayTotals,
	sameTimeLastWeek,
	totalsOfToday,
} from "~/features/restaurant";
import { buildDayReport } from "../lib/day-report";

/** The report of today against the same weekday last week at this time. It refetches every 30 s, like the orders. */
export function dayReportQueryOptions() {
	return queryOptions({
		queryKey: ["report", "day"],
		queryFn: async () => {
			const now = Date.now();
			const plannedDay = plannedDayTotals();
			const history = listDailyHistory(now, plannedDay);
			const orders = listOrders(now);
			return buildDayReport(
				orders,
				sameTimeLastWeek(history, totalsOfToday(orders), plannedDay),
				now,
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
