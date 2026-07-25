// TanStack Query mutations for publishing. Every lifecycle action refreshes
// the deployment snapshot, the publish history, the version list (isLive
// flags) and the projects caches (dashboard badge derives from deployments).

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "@/features/projects";
import type { DeploymentCurrent } from "./deployments.dto";
import { deploymentKeys } from "./deployments.queries";
import {
	publishDeployment,
	rollbackDeployment,
	unpublishDeployment,
} from "./deployments.services";
import { pageKeys } from "./pages.queries";

export function usePublishDeployment(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: { slug?: string; versionId?: string }) =>
			publishDeployment(projectId, body),
		onSuccess: ({ current }) => {
			applyDeploymentCurrent(queryClient, projectId, current);
		},
	});
}

export function useUnpublishDeployment(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => unpublishDeployment(projectId),
		onSuccess: (current) => {
			applyDeploymentCurrent(queryClient, projectId, current);
		},
	});
}

export function useRollbackDeployment(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: { deploymentId: string }) =>
			rollbackDeployment(projectId, body),
		onSuccess: ({ current }) => {
			applyDeploymentCurrent(queryClient, projectId, current);
		},
	});
}

function applyDeploymentCurrent(
	queryClient: ReturnType<typeof useQueryClient>,
	projectId: string,
	current: DeploymentCurrent,
) {
	queryClient.setQueryData(deploymentKeys.current(projectId), current);
	void queryClient.invalidateQueries({
		queryKey: deploymentKeys.current(projectId),
	});
	void queryClient.invalidateQueries({
		queryKey: deploymentKeys.list(projectId),
	});
	void queryClient.invalidateQueries({
		queryKey: pageKeys.versions(projectId),
	});
	// Dashboard status/publishedSlug are derived server-side from deployments.
	void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
	void queryClient.invalidateQueries({
		queryKey: projectKeys.detail(projectId),
	});
}
