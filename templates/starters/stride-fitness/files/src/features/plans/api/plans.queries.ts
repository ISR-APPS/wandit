// The read of the plans page: one row per plan and the 4 KPIs.
// The plans route prefetches it. The page reads it with useSuspenseQuery.
// The sample modules of ~/features/gym stand in for the tables. A later turn puts a Supabase read in the queryFn.
import { queryOptions } from "@tanstack/react-query";
import { membersOfDay, startOfLocalDay } from "~/features/gym";
import { buildPlansOverview } from "../lib/plan-summary";

/** The plans with their members, and the KPIs against 30 days ago. */
export function plansOverviewQueryOptions() {
	return queryOptions({
		queryKey: ["plans", "overview"],
		queryFn: async () => {
			const todayStart = startOfLocalDay(Date.now());
			return buildPlansOverview(membersOfDay(todayStart), todayStart);
		},
	});
}
