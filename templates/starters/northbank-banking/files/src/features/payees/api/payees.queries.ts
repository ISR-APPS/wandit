// Reads of the payees pages: every payee with its figures, and the detail of one payee.
// The payee routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample rows of ~/features/bank. A later version calls Supabase here.
import { queryOptions } from "@tanstack/react-query";
import { listTransactions, todayIsoDay } from "~/features/bank";
import { buildPayeeDetail, buildPayeeSummaries } from "../lib/payee-summary";

/** Every saved payee with its last payment and its total of the last 90 days. */
export function payeesQueryOptions() {
	return queryOptions({
		queryKey: ["payees", "list"],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildPayeeSummaries(listTransactions(today), today);
		},
	});
}

/** One payee with every payment to it. null for an unknown id. */
export function payeeDetailQueryOptions(payeeId: string) {
	return queryOptions({
		queryKey: ["payees", "detail", payeeId],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildPayeeDetail(listTransactions(today), today, payeeId);
		},
	});
}
