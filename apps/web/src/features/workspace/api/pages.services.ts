// Raw async functions for the generated landing page — NO React in here.
// Thin fetch wrappers over the shared api-client; responses parsed with the
// @wandit/contracts Zod schemas so a drifted server shape fails loudly here
// instead of as undefined deeper in the UI. This is the REAL counterpart to
// the mock getVersionPage seam in workspace.services.ts (which still feeds
// the untouched mock surfaces: assets grid, page toolbar).

import {
	type PageOverview,
	type PageVersionHtml,
	pageOverviewSchema,
	pagesRoutes,
	pageVersionHtmlSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/**
 * Everything the Page tab needs in one request: the version to show now and
 * whether a build is in flight. Polled while an attempt is queued/generating
 * (see usePageOverviewQuery).
 */
export async function getPageOverview(
	projectId: string,
): Promise<PageOverview> {
	const data = await apiClient.get<unknown>(pagesRoutes.overview(projectId));
	return pageOverviewSchema.parse(data);
}

/**
 * Full HTML of one version, fetched separately from the overview (it can be
 * hundreds of KB). Versions are immutable, so callers may cache forever.
 */
export async function getVersionHtml(
	versionId: string,
): Promise<PageVersionHtml> {
	const data = await apiClient.get<unknown>(pagesRoutes.versionHtml(versionId));
	return pageVersionHtmlSchema.parse(data);
}
