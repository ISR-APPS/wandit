// TanStack Query mutation for the feedback widget. Feedback is write-only,
// so there is no cache to update after a successful send.

import { useMutation } from "@tanstack/react-query";
import type { CreateFeedbackRequest } from "@wandit/contracts";

import { createFeedback } from "./feedback.services";

export function useCreateFeedback() {
	return useMutation({
		mutationFn: (body: CreateFeedbackRequest) => createFeedback(body),
	});
}
