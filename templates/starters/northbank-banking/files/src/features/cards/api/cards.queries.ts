// Reads of the cards pages: the card summaries, the totals of the KPI row, and one card.
// The card routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample rows of ~/features/bank. A later version calls Supabase here.
import { queryOptions } from "@tanstack/react-query";
import { listTransactions, todayIsoDay } from "~/features/bank";
import {
	buildCardDetail,
	buildCardSummaries,
	buildCardTotals,
} from "../lib/card-spend";

/** Every card with its spend this month, its status, and its last use. The home reads it too. */
export function cardsQueryOptions() {
	return queryOptions({
		queryKey: ["cards", "list"],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildCardSummaries(listTransactions(today), today);
		},
	});
}

/** The figures of the KPI row of the cards page: this month against the same days of the month before. */
export function cardTotalsQueryOptions() {
	return queryOptions({
		queryKey: ["cards", "totals"],
		queryFn: async () => {
			const today = todayIsoDay();
			return buildCardTotals(listTransactions(today), today);
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
