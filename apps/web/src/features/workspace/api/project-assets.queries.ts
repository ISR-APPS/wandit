// TanStack Query keys for the Assets tab. No interval polling: the tab
// refetches on focus, on the manual refresh button, and when a generation
// chat part invalidates the key after finishing.

import { useQuery } from "@tanstack/react-query";

import { listProjectAssets } from "./project-assets.services";

export const projectAssetKeys = {
	all: ["project-assets"] as const,
	list: (projectId: string) =>
		[...projectAssetKeys.all, "list", projectId] as const,
};

export function useProjectAssetsQuery(projectId: string) {
	return useQuery({
		queryKey: projectAssetKeys.list(projectId),
		queryFn: () => listProjectAssets(projectId),
		refetchOnWindowFocus: true,
	});
}
