import { useQuery } from "@tanstack/react-query";

import type { OverviewRange } from "./overview.dto";
import { getOverview } from "./overview.services";

export const overviewKeys = {
	all: ["admin-overview"] as const,
	snapshots: () => [...overviewKeys.all, "snapshot"] as const,
	snapshot: (range: OverviewRange) =>
		[...overviewKeys.snapshots(), range] as const,
};

export function useOverviewQuery(range: OverviewRange) {
	return useQuery({
		queryKey: overviewKeys.snapshot(range),
		queryFn: () => getOverview(range),
	});
}
