// The read of the overview: the figures, the daily series, and the breakdown of one period.
// The /app loader prefetches the default period. The overview page reads the other periods after a click.
// The queryFn reads the sample tables. A later turn replaces its body with SQL read functions that return the same type.
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables } from "~/features/tracker";
import { buildOverview, type OverviewData } from "../lib/overview-data";

/** The overview of the last `days` days. The period is in the key, so each period has its own cache entry. */
export function overviewQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", days],
		queryFn: async (): Promise<OverviewData> => {
			const tables = getSampleTables();
			return buildOverview(tables.tasks, tables.projects, days, Date.now());
		},
	});
}
