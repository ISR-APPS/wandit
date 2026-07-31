import { useQuery } from "@tanstack/react-query";

import { getAdminProject } from "./projects.services";

export const adminProjectKeys = {
	all: ["admin-project"] as const,
	detail: (projectId: string) => [...adminProjectKeys.all, projectId] as const,
};

export function useAdminProjectQuery(projectId: string | undefined) {
	return useQuery({
		queryKey: adminProjectKeys.detail(projectId ?? "none"),
		queryFn: () => getAdminProject(projectId as string),
		enabled: Boolean(projectId),
	});
}
