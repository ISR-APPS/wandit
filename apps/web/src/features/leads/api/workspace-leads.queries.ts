// TanStack Query queries + keys for the dashboard Leads page. Keys embed the
// active workspace id (the projectKeys idiom) so switching workspaces
// partitions the cache cleanly; new leads arrive from outside the app, so a
// gentle poll + refetch-on-focus is their arrival path into the UI.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { WorkspaceLeadsQuery } from "@wandit/contracts";

import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";
import { listWorkspaceLeads } from "./workspace-leads.services";

export const workspaceLeadKeys = {
	all: ["workspace-leads"] as const,
	scope: () => [...workspaceLeadKeys.all, getActiveWorkspaceId()] as const,
	lists: () => [...workspaceLeadKeys.scope(), "list"] as const,
	list: (query: WorkspaceLeadsQuery) =>
		[...workspaceLeadKeys.lists(), query] as const,
};

export function useWorkspaceLeadsQuery(query: WorkspaceLeadsQuery) {
	return useQuery({
		queryKey: workspaceLeadKeys.list(query),
		queryFn: () => listWorkspaceLeads(query),
		placeholderData: keepPreviousData,
		refetchInterval: 15_000,
		refetchOnWindowFocus: true,
	});
}
