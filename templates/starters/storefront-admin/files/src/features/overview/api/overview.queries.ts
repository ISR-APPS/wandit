// Reads of the home: every figure of one period in one summary.
// The loader of the home route prefetches the first period. The page reads the other periods after a pick.
// The queryFn reads the sample tables. A later turn replaces its body with a call of a SQL read function.
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables, type PeriodDays } from "~/features/shop";
import { buildOverviewSummary } from "../lib/summary";

/** The period of the first load, in days. The home route prefetches the summary of this period. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** The figures of the last `days` full days against the `days` days before. See buildOverviewSummary. */
export function overviewQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "summary", days],
		queryFn: async () => buildOverviewSummary(getSampleTables(), days),
	});
}
