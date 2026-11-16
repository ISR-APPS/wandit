// Reads of the home: the figures, the three daily series, and the service breakdown of one period.
// The /app loader prefetches it. OverviewPage reads it with useQuery, so a period change keeps the old view until it loads.
// The queryFn returns the sample rows today. A later turn replaces its body with SQL read functions.
import { queryOptions } from "@tanstack/react-query";
import { getStudioData, type PeriodDays } from "~/features/studio";
import { buildOverview } from "../lib/overview-data";

/** The overview of the last `days` complete days. The key holds the period. */
export function overviewQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", days],
		queryFn: async () => buildOverview(getStudioData(), days),
	});
}
