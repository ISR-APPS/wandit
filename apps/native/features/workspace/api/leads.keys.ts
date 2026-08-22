import type { LeadListFilters } from "./leads.queries";

export const leadKeys = {
	all: ["leads"] as const,
	lists: () => [...leadKeys.all, "list"] as const,
	projectLists: (projectId: string) =>
		[...leadKeys.lists(), projectId] as const,
	list: (projectId: string, filters: LeadListFilters) =>
		[...leadKeys.projectLists(projectId), filters] as const,
};

export const sheetSyncKeys = {
	all: ["lead-sheet-sync"] as const,
	state: (projectId: string) => [...sheetSyncKeys.all, projectId] as const,
};
