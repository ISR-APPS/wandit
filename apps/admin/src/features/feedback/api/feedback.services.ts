import {
	adminFeedbackDetailSchema,
	adminFeedbackStatsSchema,
	adminListFeedbackResponseSchema,
	adminRoutes,
	adminUpdateFeedbackInputSchema,
	deleteAdminFeedbackResponseSchema,
} from "@wandit/contracts";

import { apiDelete, apiGet, apiPatch } from "@/lib/api-client";

import type {
	AdminListFeedbackResponse,
	FeedbackDetailItem,
	FeedbackStats,
	ListFeedbackParams,
	UpdateFeedbackInput,
} from "./feedback.dto";

function serializeMultiValueFilter(
	values: readonly string[] | undefined,
): string | undefined {
	return values && values.length > 0 ? values.join(",") : undefined;
}

export async function listFeedback(
	params: ListFeedbackParams,
): Promise<AdminListFeedbackResponse> {
	const payload = await apiGet<unknown>(adminRoutes.feedback, {
		page: params.page,
		pageSize: params.pageSize,
		q: params.q || undefined,
		sort: params.sort,
		status: serializeMultiValueFilter(params.status),
		category: serializeMultiValueFilter(params.category),
		priority: serializeMultiValueFilter(params.priority),
	});

	return adminListFeedbackResponseSchema.parse(payload);
}

export async function getFeedback(
	feedbackId: string,
): Promise<FeedbackDetailItem> {
	const payload = await apiGet<unknown>(adminRoutes.feedbackItem(feedbackId));

	return adminFeedbackDetailSchema.parse(payload);
}

export async function getFeedbackStats(): Promise<FeedbackStats> {
	const payload = await apiGet<unknown>(adminRoutes.feedbackStats);

	return adminFeedbackStatsSchema.parse(payload);
}

export async function deleteFeedback(feedbackId: string) {
	const payload = await apiDelete<unknown>(
		adminRoutes.feedbackItem(feedbackId),
	);

	return deleteAdminFeedbackResponseSchema.parse(payload);
}

export async function updateFeedback({
	feedbackId,
	...body
}: UpdateFeedbackInput): Promise<FeedbackDetailItem> {
	const input = adminUpdateFeedbackInputSchema.parse(body);
	const payload = await apiPatch<unknown>(
		adminRoutes.feedbackItem(feedbackId),
		input,
	);

	return adminFeedbackDetailSchema.parse(payload);
}
