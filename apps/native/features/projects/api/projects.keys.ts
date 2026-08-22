import type { ListProjectsQuery } from "@wandit/contracts";

type ProjectsPagedListKey = Pick<ListProjectsQuery, "pageSize" | "search">;

export function normalizeProjectsPagedListKey({
	pageSize,
	search,
}: ProjectsPagedListKey): ProjectsPagedListKey {
	const normalizedSearch = search?.trim();

	return {
		pageSize,
		search: normalizedSearch || undefined,
	};
}

/**
 * projects.keys.ts — this feature's react-query cache keys, in one place.
 *
 * Keep list and detail labels centralized so mutations can invalidate the
 * drawer list without hand-typing string arrays in screen code.
 */
export const projectsKeys = {
	all: ["projects"] as const,
	lists: () => [...projectsKeys.all, "list"] as const,
	list: () => [...projectsKeys.lists()] as const,
	pagedList: (query: ProjectsPagedListKey) =>
		[
			...projectsKeys.lists(),
			"paged",
			normalizeProjectsPagedListKey(query),
		] as const,
	details: () => [...projectsKeys.all, "detail"] as const,
	detail: (id: string) => [...projectsKeys.details(), id] as const,
};
