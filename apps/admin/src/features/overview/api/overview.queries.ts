import { useQuery } from "@tanstack/react-query";

import type { OverviewQuery } from "./overview.dto";
import { getOverview } from "./overview.services";

export const overviewKeys = {
	all: ["admin-overview"] as const,
	snapshots: () => [...overviewKeys.all, "snapshot"] as const,
	snapshot: (query: OverviewQuery) =>
		[
			...overviewKeys.snapshots(),
			query.range,
			query.from ?? null,
			query.to ?? null,
		] as const,
};

export function useOverviewQuery(query: OverviewQuery) {
	return useQuery({
		queryKey: overviewKeys.snapshot(query),
		queryFn: () => getOverview(query),
	});
}
