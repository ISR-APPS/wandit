// TanStack Query queries + query keys for projects. queryFn delegates to
// projects.services.ts; mutations invalidate through the keys defined here.

import { useQuery } from "@tanstack/react-query";

import { getProject, listProjects } from "./projects.services";

export const projectKeys = {
	all: ["projects"] as const,
	lists: () => [...projectKeys.all, "list"] as const,
	list: () => [...projectKeys.lists()] as const,
	details: () => [...projectKeys.all, "detail"] as const,
	detail: (id: string) => [...projectKeys.details(), id] as const,
};

export function useProjectsQuery() {
	return useQuery({
		queryKey: projectKeys.list(),
		queryFn: listProjects,
	});
}

export function useProjectQuery(id: string) {
	return useQuery({
		queryKey: projectKeys.detail(id),
		queryFn: () => getProject(id),
	});
}
