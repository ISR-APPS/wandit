// TanStack Query queries + query keys for leads. queryFn delegates to
// leads.services.ts; the list stays disabled until the project record (and
// its seed leadCount) is available.

import { useQuery } from "@tanstack/react-query";

import { listLeads } from "./leads.services";

export const leadKeys = {
	all: ["leads"] as const,
	lists: () => [...leadKeys.all, "list"] as const,
	list: (projectId: string) => [...leadKeys.lists(), projectId] as const,
};

export function useLeadsQuery(
	projectId: string,
	seedCount: number | undefined,
) {
	return useQuery({
		queryKey: leadKeys.list(projectId),
		queryFn: () => listLeads(projectId, seedCount ?? 0),
		enabled: seedCount !== undefined,
	});
}
