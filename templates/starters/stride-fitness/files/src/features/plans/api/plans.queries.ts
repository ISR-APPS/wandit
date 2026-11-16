// Reads of the plans page: the summary of each plan and the payments of the next two weeks.
// The plans route prefetches them. The page reads them with useSuspenseQuery.
// The sample modules of ~/features/gym stand in for the tables. A later turn puts a Supabase read in each queryFn.
import { queryOptions } from "@tanstack/react-query";
import { membersOfDay, startOfLocalDay } from "~/features/gym";
import {
	buildPlanSummaries,
	buildUpcomingPayments,
	PAYMENT_WINDOW_DAYS,
} from "../lib/plan-summary";

/** One row per plan, in the order of the plans page, with its active and frozen members. */
export function planSummariesQueryOptions() {
	return queryOptions({
		queryKey: ["plans", "summaries"],
		queryFn: async () =>
			buildPlanSummaries(membersOfDay(startOfLocalDay(Date.now()))),
	});
}

/** The payments of the next PAYMENT_WINDOW_DAYS days, the earliest first. */
export function upcomingPaymentsQueryOptions() {
	return queryOptions({
		queryKey: ["plans", "payments", PAYMENT_WINDOW_DAYS],
		queryFn: async () => {
			const todayStart = startOfLocalDay(Date.now());
			return buildUpcomingPayments(membersOfDay(todayStart), todayStart);
		},
	});
}
