// Reads of the home: the figures of one period, the money in and out per month, and the balance line.
// The loader of the home route prefetches the default period. The cards of OverviewPage read them from the cache.
// Each queryFn reads the sample rows of ~/features/bank. A later version calls SQL read functions here.
import { queryOptions } from "@tanstack/react-query";
import {
	listDailyBalances,
	listTransactions,
	type PeriodDays,
	todayIsoDay,
} from "~/features/bank";
import {
	type BalanceScope,
	buildBalanceLine,
	buildCashFlow,
	buildOverviewSummary,
} from "../lib/overview";

/** The KPI figures, the card spend per day, and the spend by category of the last `days` days. */
export function overviewSummaryQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "summary", days],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildOverviewSummary(
				listTransactions(today),
				listDailyBalances(today),
				today,
				days,
			);
		},
	});
}

/** Money in and money out of the last 6 calendar months. The key has no period: the chart always shows 6 months. */
export function cashFlowQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "cash-flow"],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildCashFlow(listTransactions(today), today);
		},
	});
}

/** The end-of-day balance of one account, or of all three, for the last `days` days. */
export function balanceLineQueryOptions(scope: BalanceScope, days: number) {
	return queryOptions({
		queryKey: ["overview", "balance-line", scope, days],
		queryFn: async () =>
			buildBalanceLine(listDailyBalances(todayIsoDay()), scope, days),
	});
}
