// Reads of the account entries: the full list, and the detail of one entry.
// The list and detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample rows of ~/features/bank. A later version calls Supabase here.
import { queryOptions } from "@tanstack/react-query";
import { listTransactions, todayIsoDay } from "~/features/bank";
import { buildTransactionDetail } from "../lib/transaction-detail";

/** Every entry of the three accounts, newest first. The tables search, sort, and page them in the browser. */
export function transactionsQueryOptions() {
	return queryOptions({
		queryKey: ["transactions", "list"],
		queryFn: async () => listTransactions(todayIsoDay()),
	});
}

/** One entry with its transfer half, its party history, and its status steps. null for an unknown id. */
export function transactionDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["transactions", "detail", id],
		queryFn: async () =>
			buildTransactionDetail(listTransactions(todayIsoDay()), id),
	});
}
