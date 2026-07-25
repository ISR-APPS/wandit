// TanStack Query keys + query for the Google Sheets sync state. queryFn
// delegates to lead-sheet-sync.services.ts. refetchOnWindowFocus is load-
// bearing here: connecting Google happens through a full-page redirect to
// the consent screen and back, so the focus/remount refetch on return is
// what flips the button from "Connect" to "Sync".

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
		refetchOnWindowFocus: true,
	});
}
