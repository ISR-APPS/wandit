// TanStack Query queries + keys for publishing. The `current` snapshot is
// the ONE polled entry point: while a publish is in flight it refetches every
// couple of seconds and the interval switches itself off the moment the
// deployment settles (published/failed/draft).

import { useQuery } from "@tanstack/react-query";

import { SLUG_CHECK_DEBOUNCE_MS } from "../lib/constants";
import {
	getDeploymentCurrent,
	getSlugAvailability,
	listDeployments,
} from "./deployments.services";

const PUBLISH_POLL_INTERVAL_MS = 2500;

export const deploymentKeys = {
	all: ["deployments"] as const,
	currents: () => [...deploymentKeys.all, "current"] as const,
	current: (projectId: string) =>
		[...deploymentKeys.currents(), projectId] as const,
	lists: () => [...deploymentKeys.all, "list"] as const,
	list: (projectId: string) => [...deploymentKeys.lists(), projectId] as const,
	slugs: (projectId: string) =>
		[...deploymentKeys.all, "slug", projectId] as const,
	slug: (projectId: string, slug: string) =>
		[...deploymentKeys.slugs(projectId), slug] as const,
};

export function useDeploymentCurrentQuery(projectId: string) {
	return useQuery({
		queryKey: deploymentKeys.current(projectId),
		queryFn: () => getDeploymentCurrent(projectId),
		refetchInterval: (query) =>
			query.state.data?.uiState === "publishing"
				? PUBLISH_POLL_INTERVAL_MS
				: false,
	});
}

export function useDeploymentsQuery(projectId: string, enabled = true) {
	return useQuery({
		queryKey: deploymentKeys.list(projectId),
		queryFn: () => listDeployments(projectId),
		enabled,
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
		queryKey: deploymentKeys.slug(projectId, slug || "none"),
		queryFn: () => getSlugAvailability(projectId, slug),
		enabled: enabled && slug.length > 0,
		// A verdict can go stale the moment someone else publishes; keep it
		// short but non-zero so rapid re-typing of the same slug is free.
		staleTime: SLUG_CHECK_DEBOUNCE_MS * 4,
	});
}
