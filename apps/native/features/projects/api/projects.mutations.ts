import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectsKeys } from "@/features/projects/api/projects.keys";
import { createProject } from "@/features/projects/api/projects.requests";

/**
 * projects.mutations.ts — WRITE hooks.
 *
 * Creating a project changes the drawer/dashboard list, so invalidate the list
 * cache after the backend confirms creation.
 */

export function useCreateProject() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createProject,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
		},
	});
}
