import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdateFeedbackInput } from "./feedback.dto";
import { feedbackKeys } from "./feedback.queries";
import { updateFeedback } from "./feedback.services";

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
