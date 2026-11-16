// Reads of the cards pages: the card summaries, the spend breakdown, one card, and its running spend.
// The card routes prefetch them in their loaders. The pages read them with useSuspenseQuery or useQuery.
// Each queryFn reads the sample rows of ~/features/bank. A later version calls Supabase here.
import { queryOptions } from "@tanstack/react-query";
import {
	listTransactions,
	type PeriodDays,
	todayIsoDay,
} from "~/features/bank";
import {
	buildCardDetail,
	buildCardRunningSpend,
	buildCardSummaries,
	buildSpendBreakdown,
} from "../lib/card-spend";

/** Every card with its spend this month, its status, and its last use. */
export function cardsQueryOptions() {
	return queryOptions({
		queryKey: ["cards", "list"],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildCardSummaries(listTransactions(today), today);
		},
	});
}

/** Card spend of the last 30 days by spend group. The labels are group codes; the page translates them. */
export function cardSpendBreakdownQueryOptions() {
	return queryOptions({
		queryKey: ["cards", "breakdown"],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildSpendBreakdown(listTransactions(today), today);
		},
	});
}

/** One card with its payments and its top merchants. null for an unknown id. */
export function cardDetailQueryOptions(cardId: string) {
	return queryOptions({
		queryKey: ["cards", "detail", cardId],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildCardDetail(listTransactions(today), today, cardId);
		},
	});
}

/** The running spend of one card over the last `days` days, with the period before. Positive cents. */
export function cardRunningSpendQueryOptions(cardId: string, days: PeriodDays) {
	return queryOptions({
		queryKey: ["cards", "running", cardId, days],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildCardRunningSpend(
				listTransactions(today),
				today,
				cardId,
				days,
			);
		},
	});
}
