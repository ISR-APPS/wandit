import { useMutation, useQueryClient } from "@tanstack/react-query";

import { storyLinksKeys } from "./story-links.queries";
import { createStoryLink, updateStoryLink } from "./story-links.services";

/**
 * Story link writes affect both the list totals and the combined daily chart.
 * Invalidating the domain prefix keeps every selected range in sync.
 */
function useStoryLinksMutation<TVariables, TResult>(
	mutationFn: (variables: TVariables) => Promise<TResult>,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: storyLinksKeys.all });
		},
	});
}

export function useCreateStoryLinkMutation() {
	return useStoryLinksMutation(createStoryLink);
}

export function useUpdateStoryLinkMutation() {
	return useStoryLinksMutation(updateStoryLink);
}
