// TanStack Query keys + query for the Google Sheets sync state. queryFn
// delegates to lead-sheet-sync.services.ts. refetchOnWindowFocus is load-
// bearing here: connecting Google happens through a full-page redirect to
// the consent screen and back, so the focus/remount refetch on return flips
// the button from "Connect" to "Sync". Once auto-sync is enabled, TanStack
// also refreshes the state every five minutes to keep the last-sync hint fresh.

import { useQuery } from "@tanstack/react-query";

import { getSheetSyncState } from "./lead-sheet-sync.services";

export const sheetSyncKeys = {
	all: ["lead-sheet-sync"] as const,
	state: (projectId: string) => [...sheetSyncKeys.all, projectId] as const,
};

export function useSheetSyncQuery(projectId: string) {
	return useQuery({
		queryKey: sheetSyncKeys.state(projectId),
		queryFn: () => getSheetSyncState(projectId),
		enabled: projectId !== "",
		refetchInterval: (query) =>
			query.state.data?.sheet?.autoSyncEnabled ? 5 * 60_000 : false,
		refetchOnWindowFocus: true,
	});
}
