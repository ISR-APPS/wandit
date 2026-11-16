// Reads of the home: the four totals and the daily balance of all accounts.
// The loader of the home route prefetches them. OverviewPage and BalanceStrip read them from the cache.
// Each queryFn reads the sample rows of ~/features/bank. A later version calls SQL read functions here.
import { queryOptions } from "@tanstack/react-query";
import {
	listDailyBalances,
	listTransactions,
	type PeriodDays,
	todayIsoDay,
} from "~/features/bank";
import { buildBalancePoints, buildOverviewKpis } from "../lib/overview-kpis";

/** The four totals of the home. The key has no period: the totals always cover 30 days. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildOverviewKpis(
				listTransactions(today),
				listDailyBalances(today),
				today,
			);
		},
	});
}

/** The end-of-day balance of all accounts for the last `days` days, with the period before. Feeds the strip. */
export function dailyBalanceQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "balance", days],
		queryFn: async () =>
			buildBalancePoints(listDailyBalances(todayIsoDay()), days),
	});
}
