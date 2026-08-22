import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageAttemptDetail, StopPageAttemptBody } from "@wandit/contracts";

import {
	connectorGenerationKeys,
	imageGenerationKeys,
	leadScrapeKeys,
	marketingAssetKeys,
	mediaGenerationKeys,
	pageKeys,
} from "@/features/workspace/api/generation.keys";
import {
	dismissPageAttempt,
	getConnectorGenerationAttempt,
	getImageGenerationAttempt,
	getLeadScrapeAttempt,
	getMarketingAssetHtml,
	getMediaGenerationAttempt,
	getPageAttempt,
	getPageOverview,
	listMarketingAssets,
	retryPageAttempt,
	stopPageAttempt,
} from "@/features/workspace/api/generation.requests";

export const DURABLE_POLL_INTERVAL_MS = {
	page: 1_600,
	image: 1_500,
	animate: 1_500,
	marketing: 2_500,
	leads: 1_200,
	connector: 1_500,
} as const;

/**
 * Relaxed interval used when a live Trigger Realtime handle is healthy: the
 * durable row is only a safety net then, so cards poll slowly and drop back
 * to the fast interval the moment the handle fails (`pollFallback`).
 */
export const REALTIME_BACKSTOP_INTERVAL_MS = 15_000;

/**
 * One-shot durable truth — no interval. Live build progress arrives over
 * Trigger Realtime (use-live-run), whose settle invalidates this key once.
 */
export function usePageOverviewQuery(projectId: string) {
	return useQuery({
		queryKey: pageKeys.overview(projectId || "none"),
		queryFn: () => getPageOverview(projectId),
		enabled: projectId.length > 0,
		refetchOnMount: "always",
	});
}

/**
 * Durable truth for ONE build attempt's chat card. Polls while the attempt
 * is queued/generating (the Trigger Realtime stream may be absent or dead)
 * and stops itself on any terminal state or query error.
 */
export function usePageAttemptQuery(
	projectId: string,
	attemptId: string | undefined,
) {
	return useQuery({
		queryKey: pageKeys.attempt(projectId || "none", attemptId ?? "none"),
		queryFn: () => getPageAttempt(projectId, attemptId as string),
		enabled: projectId.length > 0 && Boolean(attemptId),
		refetchOnMount: "always",
		refetchInterval: (query) => {
			if (query.state.error) return false;

			const status = query.state.data?.status;
			return status === undefined ||
				status === "queued" ||
				status === "generating"
				? DURABLE_POLL_INTERVAL_MS.page
				: false;
		},
	});
}

/** Stop button on the live build card. */
export function useStopPageAttempt(projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			attemptId,
			body,
		}: {
			attemptId: string;
			body: StopPageAttemptBody;
		}) => stopPageAttempt(projectId, attemptId, body),
		onSuccess: (attempt) => {
			queryClient.setQueryData<PageAttemptDetail>(
				pageKeys.attempt(projectId, attempt.id),
				attempt,
			);
			void queryClient.invalidateQueries({
				queryKey: pageKeys.overview(projectId),
			});
		},
	});
}

/** Retry a failed build / Resume a stopped one. */
export function useRetryPageAttempt(projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ attemptId }: { attemptId: string }) =>
			retryPageAttempt(projectId, attemptId),
		onSuccess: ({ attempt }) => {
			queryClient.setQueryData<PageAttemptDetail>(
				pageKeys.attempt(projectId, attempt.id),
				attempt,
			);
			void queryClient.invalidateQueries({
				queryKey: pageKeys.overview(projectId),
			});
		},
	});
}

/** Discard/Dismiss the terminal chat card. */
export function useDismissPageAttempt(projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ attemptId }: { attemptId: string }) =>
			dismissPageAttempt(projectId, attemptId),
		onSuccess: (attempt) => {
			queryClient.setQueryData<PageAttemptDetail>(
				pageKeys.attempt(projectId, attempt.id),
				attempt,
			);
		},
	});
}

export function useImageGenerationAttemptQuery(attemptId: string) {
	return useQuery({
		queryKey: imageGenerationKeys.attempt(attemptId || "none"),
		queryFn: () => getImageGenerationAttempt(attemptId),
		enabled: attemptId.length > 0,
		refetchOnMount: "always",
		refetchInterval: (query) => {
			if (query.state.error) return false;

			const attempt = query.state.data;
			const status = attempt?.status;
			// A succeeded generation with a page placement still pending must
			// keep polling until the placement applies or fails — otherwise the
			// card would freeze on "ready" and never report the placement.
			return status === undefined ||
				status === "queued" ||
				status === "generating" ||
				(status === "succeeded" && attempt?.placement?.status === "pending")
				? DURABLE_POLL_INTERVAL_MS.image
				: false;
		},
	});
}

export function useMediaGenerationAttemptQuery(
	attemptId: string,
	intervalMs: number = DURABLE_POLL_INTERVAL_MS.animate,
) {
	return useQuery({
		queryKey: mediaGenerationKeys.attempt(attemptId || "none"),
		queryFn: () => getMediaGenerationAttempt(attemptId),
		enabled: attemptId.length > 0,
		refetchOnMount: "always",
		refetchInterval: (query) => {
			if (query.state.error) return false;

			const status = query.state.data?.status;
			return status === undefined ||
				status === "queued" ||
				status === "generating"
				? intervalMs
				: false;
		},
	});
}

export function useMarketingAssetsQuery(projectId: string) {
	return useQuery({
		queryKey: marketingAssetKeys.list(projectId || "none"),
		queryFn: () => listMarketingAssets(projectId),
		enabled: projectId.length > 0,
		refetchOnMount: "always",
		refetchInterval: (query) => {
			if (query.state.error) return false;

			const assets = query.state.data;
			const working = assets?.some(
				(asset) => asset.status === "queued" || asset.status === "generating",
			);
			return assets === undefined || working
				? DURABLE_POLL_INTERVAL_MS.marketing
				: false;
		},
	});
}

export function useMarketingAssetHtmlQuery(assetId: string | null) {
	return useQuery({
		queryKey: marketingAssetKeys.html(assetId ?? "none"),
		queryFn: () => getMarketingAssetHtml(assetId ?? ""),
		enabled: assetId !== null,
		// Finished assets are immutable — never refetch a document we have.
		staleTime: Number.POSITIVE_INFINITY,
	});
}

/**
 * Durable attempt row. With a realtime handle on the message this is a
 * one-shot fetch — live progress arrives over Trigger Realtime and settle
 * invalidates this key once. The interval only exists for legacy messages
 * with no handle, where the row is the sole transport.
 */
export function useLeadScrapeAttemptQuery(attemptId: string, poll: boolean) {
	return useQuery({
		queryKey: leadScrapeKeys.attempt(attemptId || "none"),
		queryFn: () => getLeadScrapeAttempt(attemptId),
		enabled: attemptId.length > 0,
		refetchOnMount: "always",
		refetchInterval: (query) => {
			if (!poll || query.state.error) return false;

			const status = query.state.data?.status;
			return status === undefined || status === "queued" || status === "running"
				? DURABLE_POLL_INTERVAL_MS.leads
				: false;
		},
	});
}

export function useConnectorGenerationAttemptQuery(
	attemptId: string,
	intervalMs: number = DURABLE_POLL_INTERVAL_MS.connector,
) {
	return useQuery({
		queryKey: connectorGenerationKeys.attempt(attemptId || "none"),
		queryFn: () => getConnectorGenerationAttempt(attemptId),
		enabled: attemptId.length > 0,
		refetchOnMount: "always",
		refetchInterval: (query) => {
			if (query.state.error) return false;

			const status = query.state.data?.status;
			return status === undefined || status === "queued" || status === "running"
				? intervalMs
				: false;
		},
	});
}
