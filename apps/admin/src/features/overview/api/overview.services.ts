import {
	adminOverviewQuerySchema,
	adminOverviewSnapshotSchema,
	adminRoutes,
} from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

import type { OverviewRange, OverviewSnapshot } from "./overview.dto";

export async function getOverview(
	range: OverviewRange,
): Promise<OverviewSnapshot> {
	const query = adminOverviewQuerySchema.parse({ range });
	const payload = await apiGet<unknown>(adminRoutes.overviewStats, {
		range: query.range,
	});

	return adminOverviewSnapshotSchema.parse(payload);
}
