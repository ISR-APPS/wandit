// TanStack Query layer for the Assets view (web parity: no interval polling —
// the list refetches on mount, on the manual refresh button, and when a
// finished generation card invalidates the key).

import { useQuery } from "@tanstack/react-query";

import { listProjectAssets } from "./project-assets.requests";

export const projectAssetKeys = {
	all: ["project-assets"] as const,
	list: (projectId: string) =>
		[...projectAssetKeys.all, "list", projectId] as const,
};

export function useProjectAssetsQuery(projectId: string, enabled = true) {
	return useQuery({
		queryKey: projectAssetKeys.list(projectId),
		queryFn: () => listProjectAssets(projectId),
		enabled: enabled && projectId.length > 0,
	});
}
