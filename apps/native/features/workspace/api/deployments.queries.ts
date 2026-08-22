// TanStack Query hooks for publishing. The `current` snapshot polls only
// while a publish is in flight elsewhere (uiState "publishing"); a publish
// started on THIS device resolves inside the POST, so the mutations seed the
// cache with the settled state and then refresh every surface that derives
// from deployments (history, slug verdicts, version isLive flags, dashboard
// badges).

import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	DeploymentCurrent,
	PublishDeploymentBody,
	RollbackDeploymentBody,
} from "@wandit/contracts";

import { projectsKeys } from "@/features/projects/api/projects.keys";
import {
	getDeploymentCurrent,
	getSlugAvailability,
	listDeployments,
	publishDeployment,
	rollbackDeployment,
	unpublishDeployment,
} from "@/features/workspace/api/deployments.requests";
import { pageKeys } from "@/features/workspace/api/generation.keys";

const PUBLISH_POLL_INTERVAL_MS = 2500;

/** Let typing settle before asking the server about a candidate slug. */
export const SLUG_CHECK_DEBOUNCE_MS = 500;

export const deploymentKeys = {
	all: ["deployments"] as const,
	current: (projectId: string) =>
		[...deploymentKeys.all, "current", projectId] as const,
	list: (projectId: string) =>
		[...deploymentKeys.all, "list", projectId] as const,
	slugs: (projectId: string) =>
		[...deploymentKeys.all, "slug", projectId] as const,
	slug: (projectId: string, slug: string) =>
		[...deploymentKeys.slugs(projectId), slug] as const,
};

export function useDeploymentCurrentQuery(projectId: string, enabled: boolean) {
	return useQuery({
		queryKey: deploymentKeys.current(projectId || "none"),
		queryFn: () => getDeploymentCurrent(projectId),
		enabled: enabled && projectId.length > 0,
		// A publish started on the web can be mid-flight when this screen
		// opens; poll until it settles, then switch the interval off.
		refetchInterval: (query) =>
			query.state.data?.uiState === "publishing"
				? PUBLISH_POLL_INTERVAL_MS
				: false,
	});
}

/** Publish history, newest first — fetched only while the sheet shows it. */
export function useDeploymentsQuery(projectId: string, enabled: boolean) {
	return useQuery({
		queryKey: deploymentKeys.list(projectId || "none"),
		queryFn: () => listDeployments(projectId),
		enabled: enabled && projectId.length > 0,
	});
}

/**
 * Availability of one candidate slug. Callers debounce by only enabling the
 * query once typing settles; keys are per-slug so verdicts cache naturally.
 */
export function useSlugAvailabilityQuery(
	projectId: string,
	slug: string,
	enabled: boolean,
) {
	return useQuery({
		queryKey: deploymentKeys.slug(projectId || "none", slug || "none"),
		queryFn: () => getSlugAvailability(projectId, slug),
		enabled: enabled && projectId.length > 0 && slug.length > 0,
		// A verdict can go stale the moment someone else publishes; keep it
		// short but non-zero so rapid re-typing of the same slug is free.
		staleTime: SLUG_CHECK_DEBOUNCE_MS * 4,
	});
}

export function usePublishDeploymentMutation(projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		// The default {} keeps bare `.mutate()` callers publishing the draft
		// head under the live/generated slug (page-build-card's panel).
		mutationFn: (body?: PublishDeploymentBody) =>
			publishDeployment(projectId, body ?? {}),
		onSuccess: (response) => {
			applyDeploymentCurrent(queryClient, projectId, response.current);
		},
	});
}

export function useUnpublishDeploymentMutation(projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => unpublishDeployment(projectId),
		onSuccess: (current) => {
			applyDeploymentCurrent(queryClient, projectId, current);
		},
	});
}

export function useRollbackDeploymentMutation(projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: RollbackDeploymentBody) =>
			rollbackDeployment(projectId, body),
		onSuccess: (response) => {
			applyDeploymentCurrent(queryClient, projectId, response.current);
		},
	});
}

function applyDeploymentCurrent(
	queryClient: QueryClient,
	projectId: string,
	current: DeploymentCurrent,
) {
	queryClient.setQueryData(deploymentKeys.current(projectId), current);
	void queryClient.invalidateQueries({
		queryKey: deploymentKeys.current(projectId),
	});
	void queryClient.invalidateQueries({
		queryKey: deploymentKeys.slugs(projectId),
	});
	void queryClient.invalidateQueries({
		queryKey: deploymentKeys.list(projectId),
	});
	void queryClient.invalidateQueries({
		queryKey: pageKeys.versions(projectId),
	});
	// Drawer badges (published slug/status) derive server-side from deployments.
	void queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
	void queryClient.invalidateQueries({
		queryKey: projectsKeys.detail(projectId),
	});
}
