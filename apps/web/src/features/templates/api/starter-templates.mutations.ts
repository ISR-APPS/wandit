/**
 * Mutations of the starter templates feature.
 * Called by lib/hooks.ts for the "Use this template" button.
 * Calls starter-templates.services.ts and marks the project lists and the credits stale.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { creditsKeys } from "@/features/credits";
import { projectKeys } from "@/features/projects";
import { createProjectFromStarterTemplate } from "./starter-templates.services";

/**
 * Creates a V2 project from a starter template. The dashboard grid lists the
 * new project, so the project lists refresh. The credits refresh after a
 * success and after a failure: after a 402 the cached balance is stale.
 */
export function useCreateProjectFromStarterTemplate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createProjectFromStarterTemplate,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: creditsKeys.scope() });
		},
	});
}
