// Reads of the home: the four figures, the uploads per day by category, and the uploads by team.
// The home route loader prefetches them. OverviewPage and its panels read them with useSuspenseQuery or useQuery.
// Each queryFn reads the sample workspace now. A later turn replaces each body with one Supabase rpc call.
import { queryOptions } from "@tanstack/react-query";
import { readWorkspace } from "~/features/workspace";
import {
	buildOverviewKpis,
	dailyUploadsByCategory,
	type PeriodDays,
	uploadsByTeam,
} from "../lib/series";

/** The four figures of the band. The key has no period: each figure names its own window. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => {
			const now = Date.now();
			return buildOverviewKpis(readWorkspace(now), now);
		},
	});
}

/** Uploads per day and category for the last `days` days. Feeds the stacked trend panel. */
export function dailyUploadsQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["uploads", "daily", days],
		queryFn: async () => {
			const now = Date.now();
			return dailyUploadsByCategory(readWorkspace(now).uploads, days, now);
		},
	});
}

/** Uploads per team in the last `days` days, the largest first. Feeds the breakdown panel. */
export function uploadsByTeamQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["uploads", "by-team", days],
		queryFn: async () => {
			const now = Date.now();
			return uploadsByTeam(readWorkspace(now).uploads, days, now);
		},
	});
}
