// TanStack Query queries + query keys for leads. queryFn delegates to
// leads.services.ts. The query only mounts while the Leads tab is open, and
// new leads arrive from outside the app (published-page form posts), so a
// gentle poll + refetch-on-focus is their arrival path into the UI.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { LeadsQuery } from "@wandit/contracts";

import { listLeads } from "./leads.services";

export const leadKeys = {
	all: ["leads"] as const,
	lists: () => [...leadKeys.all, "list"] as const,
	projectLists: (projectId: string) =>
		[...leadKeys.lists(), projectId] as const,
	list: (projectId: string, query: LeadsQuery) =>
		[...leadKeys.projectLists(projectId), query] as const,
};

export function useLeadsQuery(projectId: string, query: LeadsQuery) {
	return useQuery({
		queryKey: leadKeys.list(projectId, query),
		queryFn: () => listLeads(projectId, query),
		enabled: projectId !== "",
		placeholderData: keepPreviousData,
		refetchInterval: 15_000,
		refetchOnWindowFocus: true,
	});
}
