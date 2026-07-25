// TanStack Query queries + query keys for leads. queryFn delegates to
// leads.services.ts. The query only mounts while the Leads tab is open, and
// new leads arrive from outside the app (published-page form posts), so a
// gentle poll + refetch-on-focus is their arrival path into the UI.

import { useQuery } from "@tanstack/react-query";

import { listLeads } from "./leads.services";

export const leadKeys = {
	all: ["leads"] as const,
	lists: () => [...leadKeys.all, "list"] as const,
	list: (projectId: string) => [...leadKeys.lists(), projectId] as const,
};

export function useLeadsQuery(projectId: string) {
	return useQuery({
		queryKey: leadKeys.list(projectId),
		queryFn: () => listLeads(projectId),
		enabled: projectId !== "",
		refetchInterval: 15_000,
		refetchOnWindowFocus: true,
	});
}
