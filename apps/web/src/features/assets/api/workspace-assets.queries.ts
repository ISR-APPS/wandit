// TanStack Query keys for the dashboard Assets page. Keys embed the active
// workspace id so switching workspaces partitions the cache cleanly. No
// interval polling: the page refetches on focus and the manual refresh
// button.

import { useQuery } from "@tanstack/react-query";

import { getActiveWorkspaceId } from "@/features/workspaces/lib/workspace-scope";
import { listWorkspaceAssets } from "./workspace-assets.services";

export const workspaceAssetKeys = {
	all: ["workspace-assets"] as const,
	scope: () => [...workspaceAssetKeys.all, getActiveWorkspaceId()] as const,
	list: () => [...workspaceAssetKeys.scope(), "list"] as const,
};

export function useWorkspaceAssetsQuery() {
	return useQuery({
		queryKey: workspaceAssetKeys.list(),
		queryFn: listWorkspaceAssets,
		refetchOnWindowFocus: true,
	});
}
