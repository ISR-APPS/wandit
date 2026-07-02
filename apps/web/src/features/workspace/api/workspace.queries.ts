// TanStack Query queries + query keys for the workspace state (chat,
// versions, deployment, pixels — fetched as one unit). The generation and
// publish simulations in lib/store.tsx refresh this cache via setQueryData
// with fresh mock snapshots.

import { useQuery } from "@tanstack/react-query";

import { fetchWorkspaceState } from "./workspace.services";

export const workspaceKeys = {
	all: ["workspace"] as const,
	state: (projectId: string) =>
		[...workspaceKeys.all, "state", projectId] as const,
};

export function useWorkspaceStateQuery(projectId: string) {
	return useQuery({
		queryKey: workspaceKeys.state(projectId),
		queryFn: () => fetchWorkspaceState(projectId),
	});
}
