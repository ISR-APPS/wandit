// TanStack Query hooks + keys for the generated landing page. The overview
// is the ONE polled entry point: while the latest attempt is still running it
// refetches every 1.5s, and the interval switches itself off the moment the
// attempt settles (succeeded/failed) or when there is no attempt at all —
// TanStack re-evaluates the refetchInterval callback after every fetch.

import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { PageOverview } from "@wandit/contracts";

import {
	getPageOverview,
	getPageVersions,
	getVersionHtml,
	restorePageVersion,
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

/**
 * Restore conflicts carry newer server truth. Refresh the overview after any
 * failed restore so the next attempt cannot remain pinned to a stale active id.
 */
export function refreshOverviewAfterRestoreFailure(
	queryClient: Pick<QueryClient, "invalidateQueries">,
	projectId: string,
): void {
	void queryClient.invalidateQueries({
		queryKey: pageKeys.overview(projectId),
	});
}

export function useRestorePageVersion(projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			versionId,
			expectedActiveVersionId,
		}: {
			versionId: string;
			expectedActiveVersionId: string;
		}) => restorePageVersion(projectId, versionId, { expectedActiveVersionId }),
		onSuccess: ({ version }) => {
			queryClient.setQueryData<PageOverview>(
				pageKeys.overview(projectId),
				(current) =>
					current ? { ...current, activeVersion: version } : current,
			);
			void queryClient.invalidateQueries({
				queryKey: pageKeys.overview(projectId),
			});
			void queryClient.invalidateQueries({
				queryKey: pageKeys.versions(projectId),
			});
		},
		onError: () => {
			// A restore can race any edit made in another tab. Refresh server truth
			// after failures so a 409 retry uses the new active version id instead
			// of remaining permanently pinned to the stale expectation.
			refreshOverviewAfterRestoreFailure(queryClient, projectId);
		},
	});
}
