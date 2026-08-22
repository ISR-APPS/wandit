// Query hooks for the page screen (web parity: api/pages.queries.ts). The
// chat card's one-shot overview hook lives in generation.queries.ts; the page
// screen wants the POLLING variant — same cache key, its own observer
// interval — so the preview follows a build without Trigger Realtime.

import { useQuery } from "@tanstack/react-query";

import { pageKeys } from "@/features/workspace/api/generation.keys";
import { getPageOverview } from "@/features/workspace/api/generation.requests";
import {
	getPageVersions,
	getVersionHtml,
} from "@/features/workspace/api/pages.requests";

/** Overview that polls every 1.5s while a build is queued/generating and
 * switches itself off the moment the attempt settles (web parity). */
export function usePageOverviewPollingQuery(projectId: string) {
	return useQuery({
		queryKey: pageKeys.overview(projectId || "none"),
		queryFn: () => getPageOverview(projectId),
		enabled: projectId.length > 0,
		refetchOnMount: "always",
		refetchInterval: (query) => {
			if (query.state.error) return false;

			const status = query.state.data?.latestAttempt?.status;
			return status === "queued" || status === "generating" ? 1_500 : false;
		},
	});
}

/** Immutable HTML of one version — once fetched it never goes stale. */
export function useVersionHtmlQuery(versionId: string | undefined) {
	return useQuery({
		queryKey: pageKeys.versionHtml(versionId ?? "none"),
		// Safe cast: `enabled` below guarantees queryFn never runs without an id.
		queryFn: () => getVersionHtml(versionId as string),
		enabled: Boolean(versionId),
		staleTime: Number.POSITIVE_INFINITY,
	});
}

/** Version history (newest first) — feeds the theme reset's builder-origin
 * lookup. Fetched lazily: only mounted while the editor sheet is open. */
export function usePageVersionsQuery(projectId: string, enabled: boolean) {
	return useQuery({
		queryKey: pageKeys.versions(projectId || "none"),
		queryFn: () => getPageVersions(projectId),
		enabled: enabled && projectId.length > 0,
	});
}
