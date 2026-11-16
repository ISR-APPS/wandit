// Reads of budgets: the report of one calendar month.
// The budgets route prefetches both months in its loader. BudgetsPage reads the month of the URL from the cache.
// The queryFn returns figures of the sample ledger. To make it real: replace the body with a Supabase rpc call.
import { queryOptions } from "@tanstack/react-query";
import { listBudgets, listTransactions, toIsoDay } from "~/features/ledger";
import { type BudgetMonth, buildBudgetReport } from "../lib/budget-report";

/** Every budget with its spend for the current month or the month before, plus the daily spend curve. */
export function budgetReportQueryOptions(month: BudgetMonth) {
	return queryOptions({
		queryKey: ["budgets", "report", month],
		queryFn: async () => {
			const now = Date.now();
			return buildBudgetReport(
				month,
				listTransactions(now),
				listBudgets(),
				toIsoDay(now),
			);
		},
	});
}
