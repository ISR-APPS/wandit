// TanStack Query hooks + keys for the generated landing page. The overview
// is the ONE polled entry point: while the latest attempt is still running it
// refetches every 1.5s, and the interval switches itself off the moment the
// attempt settles (succeeded/failed) or when there is no attempt at all —
// TanStack re-evaluates the refetchInterval callback after every fetch.

import { useQuery } from "@tanstack/react-query";

import {
	getPageOverview,
	getPageVersions,
	getVersionHtml,
} from "./pages.services";

export const pageKeys = {
	all: ["pages"] as const,
	overview: (projectId: string) =>
		[...pageKeys.all, "overview", projectId] as const,
	versionHtml: (versionId: string) =>
		[...pageKeys.all, "version-html", versionId] as const,
	versions: (projectId: string) =>
		[...pageKeys.all, "versions", projectId] as const,
};

export function usePageOverviewQuery(projectId: string) {
	return useQuery({
		queryKey: pageKeys.overview(projectId),
		queryFn: () => getPageOverview(projectId),
		refetchInterval: (query) => {
			const status = query.state.data?.latestAttempt?.status;
			// Poll only while a build is actually in flight.
			return status === "queued" || status === "generating" ? 1500 : false;
		},
	});
}

export function usePageVersionsQuery(projectId: string) {
	return useQuery({
		queryKey: pageKeys.versions(projectId),
		queryFn: () => getPageVersions(projectId),
	});
}

export function useVersionHtmlQuery(versionId: string | undefined) {
	return useQuery({
		// Placeholder key while no version exists yet — same dependent-query
		// idiom as useChatMessagesQuery (the "none" entry just sits unused).
		queryKey: pageKeys.versionHtml(versionId ?? "none"),
		// Safe cast: `enabled` below guarantees queryFn never runs without an id.
		queryFn: () => getVersionHtml(versionId as string),
		enabled: Boolean(versionId),
		// Versions are immutable — once fetched, the HTML never goes stale.
		staleTime: Number.POSITIVE_INFINITY,
	});
}
