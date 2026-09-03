import {
	adminOverviewQuerySchema,
	adminOverviewSnapshotSchema,
	adminRoutes,
} from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

import type { OverviewQuery, OverviewSnapshot } from "./overview.dto";

export async function getOverview(
	query: OverviewQuery,
): Promise<OverviewSnapshot> {
	const parsedQuery = adminOverviewQuerySchema.parse(query);
	const payload = await apiGet<unknown>(adminRoutes.overviewStats, parsedQuery);

	return adminOverviewSnapshotSchema.parse(payload);
}
