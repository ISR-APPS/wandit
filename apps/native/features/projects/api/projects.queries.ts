import {
	type InfiniteData,
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	ListProjectsPageResponse,
	ListProjectsResponse,
	Project,
} from "@wandit/contracts";

import {
	normalizeProjectsPagedListKey,
	projectsKeys,
} from "@/features/projects/api/projects.keys";
import {
	getProject,
	listProjects,
	listProjectsPaged,
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

const projectsPageSize = 20;

export function useInfiniteProjects(search: string) {
	const query = normalizeProjectsPagedListKey({
		pageSize: projectsPageSize,
		search,
	});

	return useInfiniteQuery({
		queryKey: projectsKeys.pagedList(query),
		queryFn: ({ pageParam }) =>
			listProjectsPaged({
				...query,
				page: pageParam,
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.page * lastPage.pageSize < lastPage.total
				? lastPage.page + 1
				: undefined,
		placeholderData: keepPreviousData,
	});
}

// Load a single project, seeding from the list cache when available.
export function useProject(projectId?: string) {
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: projectsKeys.detail(projectId ?? ""),
		queryFn: () => getProject(projectId ?? ""),
		enabled: !!projectId,
		initialData: () => {
			if (!projectId) {
				return undefined;
			}

			const listCaches = queryClient.getQueriesData<
				ListProjectsResponse | InfiniteData<ListProjectsPageResponse>
			>({
				queryKey: projectsKeys.lists(),
			});

			for (const [, cachedData] of listCaches) {
				const project = Array.isArray(cachedData)
					? cachedData.find((item: Project) => item.id === projectId)
					: cachedData?.pages
							.flatMap((page) => page.items)
							.find((item) => item.id === projectId);

				if (project) {
					return project;
				}
			}

			return undefined;
		},
	});
}
