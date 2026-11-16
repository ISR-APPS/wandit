// Reads of the team: the load of every member over a period of 7, 30, or 90 days.
// The Team route and the overview prefetch it in their loaders. The period is part of the key.
// The queryFn returns the sample rows today. A later turn replaces its body with a Supabase read.
import { queryOptions } from "@tanstack/react-query";
import { getStudioData, type PeriodDays } from "~/features/studio";
import { buildTeamLoad } from "../lib/team-load";

/** The load of every member over the last `days` complete days. */
export function teamLoadQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["team", "load", days],
		queryFn: async () => buildTeamLoad(getStudioData(), days),
	});
}
