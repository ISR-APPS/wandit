import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdateFeedbackInput } from "./feedback.dto";
import { feedbackKeys } from "./feedback.queries";
import { deleteFeedback, updateFeedback } from "./feedback.services";

export function useDeleteFeedbackMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteFeedback,
		onSuccess: async (_result, feedbackId) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: feedbackKeys.lists() }),
				queryClient.invalidateQueries({ queryKey: feedbackKeys.stats() }),
			]);
			queryClient.removeQueries({
				queryKey: feedbackKeys.detail(feedbackId),
			});
		},
	});
}

export function useUpdateFeedbackMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: UpdateFeedbackInput) => updateFeedback(input),
		onSuccess: (feedback) => {
			queryClient.setQueryData(feedbackKeys.detail(feedback.id), feedback);
			void queryClient.invalidateQueries({ queryKey: feedbackKeys.lists() });
			void queryClient.invalidateQueries({ queryKey: feedbackKeys.stats() });
		},
	});
}
