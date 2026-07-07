import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@wandit/contracts";

import { projectsKeys } from "@/features/projects/api/projects.keys";
import {
	getProject,
	listProjects,
} from "@/features/projects/api/projects.requests";

/**
 * projects.queries.ts — READ hooks.
 *
 * Components import hooks from the feature barrel so reads share cache keys,
 * request validation, loading state, and deduping.
 */

// List dashboard/drawer projects.
export function useProjects() {
	return useQuery({
		queryKey: projectsKeys.list(),
		queryFn: listProjects,
	});
}

// Load a single project, seeding from the list cache when available.
export function useProject(projectId?: string) {
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: projectsKeys.detail(projectId ?? ""),
		queryFn: () => getProject(projectId ?? ""),
		enabled: !!projectId,
		initialData: () =>
			projectId
				? queryClient
						.getQueryData<Project[]>(projectsKeys.list())
						?.find((project) => project.id === projectId)
				: undefined,
	});
}
