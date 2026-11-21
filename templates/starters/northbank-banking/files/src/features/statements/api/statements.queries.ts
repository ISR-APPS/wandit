// Reads of the statements pages: every statement, and one statement with its lines.
// The statement routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample rows of ~/features/bank. A later version calls Supabase here.
import { queryOptions } from "@tanstack/react-query";
import {
	listDailyBalances,
	listTransactions,
	todayIsoDay,
} from "~/features/bank";
import { buildStatementDetail, buildStatements } from "../lib/statements";

/** Every statement of the three accounts: the open month and 5 closed months, newest first. */
export function statementsQueryOptions() {
	return queryOptions({
		queryKey: ["statements", "list"],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildStatements(
				listTransactions(today),
				listDailyBalances(today),
				today,
			);
		},
	});
}

/** One statement with its lines and the running balance. null for an unknown id. */
export function statementDetailQueryOptions(statementId: string) {
	return queryOptions({
		queryKey: ["statements", "detail", statementId],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildStatementDetail(
				listTransactions(today),
				listDailyBalances(today),
				today,
				statementId,
			);
		},
	});
}
