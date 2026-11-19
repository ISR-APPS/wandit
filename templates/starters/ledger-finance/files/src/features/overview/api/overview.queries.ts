// Reads of the home: the summary of one period and the expenses of the last 6 months.
// The loader of the home route prefetches them. OverviewPage reads them; another period loads on demand.
// Each queryFn returns figures of the sample ledger. To make it real: replace the body with a Supabase rpc call.
import { queryOptions } from "@tanstack/react-query";
import {
	listAccounts,
	listDailyBalances,
	listTransactions,
	type PeriodDays,
	toIsoDay,
} from "~/features/ledger";
import {
	buildMonthlyExpenses,
	buildOverviewSummary,
} from "../lib/overview-summary";

/** The KPI figures, the income sources, and the spending split of the last `days` days. */
export function overviewQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "summary", days],
		queryFn: async () => {
			const now = Date.now();
			return buildOverviewSummary(
				listTransactions(now),
				listAccounts(),
				listDailyBalances(now),
				toIsoDay(now),
				days,
			);
		},
	});
}

/** The expenses of this month and the 5 months before. The key has no period: the chart shows calendar months. */
export function monthlyExpensesQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "monthly-expenses"],
		queryFn: async () => {
			const now = Date.now();
			return buildMonthlyExpenses(listTransactions(now), toIsoDay(now));
		},
	});
}
