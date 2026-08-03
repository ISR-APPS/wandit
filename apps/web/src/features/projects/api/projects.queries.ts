// TanStack Query queries + query keys for projects. queryFn delegates to
// projects.services.ts; mutations invalidate through the keys defined here.

import { useQuery } from "@tanstack/react-query";

import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";

import { getProject, listProjects } from "./projects.services";

// Keys carry the ACTIVE WORKSPACE segment (teams-workspaces.md §9): switching
// workspaces changes every key, so caches partition cleanly per workspace.
export const projectKeys = {
	all: ["projects"] as const,
	scope: () => [...projectKeys.all, getActiveWorkspaceId()] as const,
	lists: () => [...projectKeys.scope(), "list"] as const,
	list: () => [...projectKeys.lists()] as const,
	details: () => [...projectKeys.scope(), "detail"] as const,
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
