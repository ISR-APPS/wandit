import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ListFeedbackParams } from "./feedback.dto";
import {
	getFeedback,
	getFeedbackStats,
	listFeedback,
} from "./feedback.services";

export const feedbackKeys = {
	all: ["admin-feedback"] as const,
	lists: () => [...feedbackKeys.all, "list"] as const,
	list: (params: ListFeedbackParams) =>
		[...feedbackKeys.lists(), params] as const,
	details: () => [...feedbackKeys.all, "detail"] as const,
	detail: (feedbackId: string) =>
		[...feedbackKeys.details(), feedbackId] as const,
	stats: () => [...feedbackKeys.all, "stats"] as const,
};

export function useFeedbackListQuery(params: ListFeedbackParams) {
	return useQuery({
		queryKey: feedbackKeys.list(params),
		queryFn: () => listFeedback(params),
		placeholderData: keepPreviousData,
	});
}

export function useFeedbackDetailQuery(feedbackId: string | null) {
	return useQuery({
		queryKey: feedbackKeys.detail(feedbackId ?? "none"),
		queryFn: () => getFeedback(feedbackId as string),
		enabled: Boolean(feedbackId),
	});
}

export function useFeedbackStatsQuery() {
	return useQuery({
		queryKey: feedbackKeys.stats(),
		queryFn: getFeedbackStats,
	});
}
