// Raw async function for the in-app feedback widget — NO React in here.
// The response is parsed with the @wandit/contracts Zod schema at this
// boundary so a drifted server payload fails loudly here.

import {
	type CreateFeedbackRequest,
	type CreateFeedbackResponse,
	createFeedbackResponseSchema,
	feedbackRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/** Send one feedback report. The server creates the Linear issue. */
export async function createFeedback(
	body: CreateFeedbackRequest,
): Promise<CreateFeedbackResponse> {
	const data = await apiClient.post<unknown>(feedbackRoutes.create, body);
	return createFeedbackResponseSchema.parse(data);
}
