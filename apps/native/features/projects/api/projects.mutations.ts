import {
	type InfiniteData,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import type { ListProjectsPageResponse, Project } from "@wandit/contracts";

import { projectsKeys } from "@/features/projects/api/projects.keys";
import {
	createProject,
	deleteProject,
	updateProject,
} from "@/features/projects/api/projects.requests";

/**
 * projects.mutations.ts — WRITE hooks.
 *
 * Creating a project changes the drawer/dashboard list, so invalidate the list
 * cache after the backend confirms creation. Rename patches every list cache
 * in place; delete removes optimistically with rollback. Both list shapes live
 * under projectsKeys.lists(): the flat array (list) and the infinite paged
 * data (pagedList), so cache writes must handle both.
 */

type ProjectsListCache = Project[] | InfiniteData<ListProjectsPageResponse>;

function mapListCache(
	cached: ProjectsListCache | undefined,
	mapProject: (project: Project) => Project | null,
): ProjectsListCache | undefined {
	if (!cached) {
		return cached;
	}

	if (Array.isArray(cached)) {
		return cached.flatMap((project) => mapProject(project) ?? []);
	}

	return {
		...cached,
		pages: cached.pages.map((page) => {
			const items = page.items.flatMap((project) => mapProject(project) ?? []);
			return {
				...page,
				items,
				total: page.total - (page.items.length - items.length),
			};
		}),
	};
}

export function useCreateProject() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createProject,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
		},
	});
}

export function useRenameProject() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
			updateProject(projectId, { name }),
		onSuccess: (project) => {
			queryClient.setQueryData(projectsKeys.detail(project.id), project);
			for (const [queryKey, cached] of queryClient.getQueriesData<
				ProjectsListCache
			>({ queryKey: projectsKeys.lists() })) {
				queryClient.setQueryData(
					queryKey,
					mapListCache(cached, (item) =>
						item.id === project.id ? project : item,
					),
				);
			}
			void queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
		},
	});
}

export function useDeleteProject() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (projectId: string) => deleteProject(projectId),
		// Remove the row optimistically so the drawer reacts on tap; roll every
		// touched list cache back if the backend refuses.
		onMutate: async (projectId) => {
			await queryClient.cancelQueries({ queryKey: projectsKeys.lists() });
			const previous = queryClient.getQueriesData<ProjectsListCache>({
				queryKey: projectsKeys.lists(),
			});

			for (const [queryKey, cached] of previous) {
				queryClient.setQueryData(
					queryKey,
					mapListCache(cached, (item) =>
						item.id === projectId ? null : item,
					),
				);
			}

			return { previous };
		},
		onError: (_error, _projectId, context) => {
			for (const [queryKey, cached] of context?.previous ?? []) {
				queryClient.setQueryData(queryKey, cached);
			}
		},
		// Drop (not invalidate) the detail entry: the project no longer exists,
		// so a refetch can only 404 — a later mount of /project/{id} must take
		// the cold-fetch error path instead of rendering the stale cache.
		onSuccess: (_data, projectId) => {
			queryClient.removeQueries({ queryKey: projectsKeys.detail(projectId) });
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
		},
	});
}
