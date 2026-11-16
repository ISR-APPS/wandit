// Reads of the home: the KPI figures and the leads per day.
// The loader of the home route prefetches them. OverviewPage and LeadsTrendCard read them from the cache.
// Each queryFn computes its result from sample rows of ~/features/agency.
// To make it real: one SQL read function per query (data.md of the app-dashboard skill), called with rpc.
import { queryOptions } from "@tanstack/react-query";
import {
	readLeadRows,
	readListingRows,
	readViewingRows,
} from "~/features/agency";
import {
	buildDailyLeads,
	buildOverviewKpis,
	type PeriodDays,
} from "../lib/series";

/** The KPI rows of the home, for the last 30 days. The key has no period. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => {
			const now = Date.now();
			return buildOverviewKpis(
				readLeadRows(now),
				readViewingRows(now),
				readListingRows(now),
				now,
			);
		},
	});
}

/** New leads per day for the last `days` days, with the same days one period earlier. Feeds the trend panel. */
export function dailyLeadsQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["leads", "daily", days],
		queryFn: async () => {
			const now = Date.now();
			return buildDailyLeads(readLeadRows(now), days, now);
		},
	});
}
