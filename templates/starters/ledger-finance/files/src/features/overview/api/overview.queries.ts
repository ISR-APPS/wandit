// Reads of the home: the KPI rows and the daily money in and out.
// The loader of the home route prefetches them. OverviewPage and CashFlowStrip read them from the cache.
// Each queryFn returns figures of the sample ledger. To make it real: replace the body with a Supabase rpc call.
import { queryOptions } from "@tanstack/react-query";
import {
	listAccounts,
	listDailyBalances,
	listTransactions,
	type PeriodDays,
	toIsoDay,
} from "~/features/ledger";
import { buildDailyCashFlow, buildOverviewKpis } from "../lib/overview-kpis";

/** The KPI rows of the home: income, expenses, net, cash, and the card debt. The key has no period. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => {
			const now = Date.now();
			return buildOverviewKpis(
				listTransactions(now),
				listAccounts(),
				listDailyBalances(now),
				toIsoDay(now),
			);
		},
	});
}

/** Money in and money out per day for the last `days` days. Feeds the cash flow strip. Transfers do not count. */
export function dailyCashFlowQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["cash-flow", "daily", days],
		queryFn: async () => {
			const now = Date.now();
			return buildDailyCashFlow(listTransactions(now), toIsoDay(now), days);
		},
	});
}
