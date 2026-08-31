import {
	aiErrorDataSchema,
	type ConnectorGenerationAttempt,
	connectorGenerationAttemptSchema,
	connectorGenerationsRoutes,
	type ImageGenerationAttempt,
	imageGenerationAttemptSchema,
	imageGenerationsRoutes,
	type LeadScrapeAttempt,
	leadScrapeAttemptSchema,
	leadScrapesRoutes,
	type MarketingAsset,
	type MarketingAssetHtmlResponse,
	type MediaGenerationAttempt,
	marketingAssetHtmlResponseSchema,
	marketingAssetsResponseSchema,
	marketingAssetsRoutes,
	mediaGenerationAttemptSchema,
	mediaGenerationsRoutes,
	type PageAttemptDetail,
	type PageOverview,
	pageAttemptDetailSchema,
	pageOverviewSchema,
	pagesRoutes,
	type RetryPageAttemptResponse,
	retryPageAttemptResponseSchema,
	type StopPageAttemptBody,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";
import { getServerUrl } from "@/shared/lib/server-url";

// The shared lead DTO is being rolled out independently. Keep the native
// parser forward-compatible so Zod does not strip C4's optional failure.
const nativeLeadScrapeAttemptSchema = leadScrapeAttemptSchema.extend({
	failure: aiErrorDataSchema.nullable().optional(),
});

export async function getPageOverview(
	projectId: string,
): Promise<PageOverview> {
	const data = await apiClient.get<unknown>(pagesRoutes.overview(projectId));
	return pageOverviewSchema.parse(data);
}

/** Durable truth for ONE build attempt — the chat card's fallback + terminal state. */
export async function getPageAttempt(
	projectId: string,
	attemptId: string,
): Promise<PageAttemptDetail> {
	const data = await apiClient.get<unknown>(
		pagesRoutes.attempt(projectId, attemptId),
	);
	return pageAttemptDetailSchema.parse(data);
}

export async function stopPageAttempt(
	projectId: string,
	attemptId: string,
	body: StopPageAttemptBody,
): Promise<PageAttemptDetail> {
	const data = await apiClient.post<unknown>(
		pagesRoutes.stopAttempt(projectId, attemptId),
		body,
	);
	return pageAttemptDetailSchema.parse(data);
}

/** Retry a failed build / resume a stopped one on the same attempt row. */
export async function retryPageAttempt(
	projectId: string,
	attemptId: string,
): Promise<RetryPageAttemptResponse> {
	const data = await apiClient.post<unknown>(
		pagesRoutes.retryAttempt(projectId, attemptId),
		{},
	);
	return retryPageAttemptResponseSchema.parse(data);
}

/** Dismiss/discard the terminal chat card — pure UI bookkeeping. */
export async function dismissPageAttempt(
	projectId: string,
	attemptId: string,
): Promise<PageAttemptDetail> {
	const data = await apiClient.post<unknown>(
		pagesRoutes.dismissAttempt(projectId, attemptId),
		{},
	);
	return pageAttemptDetailSchema.parse(data);
}

/** Credentialed forced-download endpoint for one image (1-based index). */
export function imageGenerationDownloadUrl(attemptId: string, index: number) {
	return `${getServerUrl().replace(/\/$/, "")}${imageGenerationsRoutes.download(
		attemptId,
		index,
	)}`;
}

/** Credentialed download endpoint for a finished video/animation. */
export function mediaGenerationDownloadUrl(attemptId: string) {
	return `${getServerUrl().replace(/\/$/, "")}${mediaGenerationsRoutes.download(
		attemptId,
	)}`;
}

export async function getImageGenerationAttempt(
	attemptId: string,
): Promise<ImageGenerationAttempt> {
	const data = await apiClient.get<unknown>(
		imageGenerationsRoutes.attempt(attemptId),
	);
	return imageGenerationAttemptSchema.parse(data);
}

export async function getMediaGenerationAttempt(
	attemptId: string,
): Promise<MediaGenerationAttempt> {
	const data = await apiClient.get<unknown>(
		mediaGenerationsRoutes.attempt(attemptId),
	);
	return mediaGenerationAttemptSchema.parse(data);
}

export async function listMarketingAssets(
	projectId: string,
): Promise<MarketingAsset[]> {
	const data = await apiClient.get<unknown>(
		marketingAssetsRoutes.list(projectId),
	);
	return marketingAssetsResponseSchema.parse(data).assets;
}

/** One finished asset's HTML document (JSON envelope → sandboxed WebView). */
export async function getMarketingAssetHtml(
	assetId: string,
): Promise<MarketingAssetHtmlResponse> {
	const data = await apiClient.get<unknown>(
		marketingAssetsRoutes.html(assetId),
	);
	return marketingAssetHtmlResponseSchema.parse(data);
}

/** Credentialed forced-download endpoint for the HTML file. */
export function marketingAssetDownloadUrl(assetId: string): string {
	return `${getServerUrl().replace(/\/$/, "")}${marketingAssetsRoutes.download(
		assetId,
	)}`;
}

export async function getLeadScrapeAttempt(
	attemptId: string,
): Promise<LeadScrapeAttempt> {
	const data = await apiClient.get<unknown>(
		leadScrapesRoutes.attempt(attemptId),
	);
	return nativeLeadScrapeAttemptSchema.parse(data);
}

export async function getConnectorGenerationAttempt(
	attemptId: string,
): Promise<ConnectorGenerationAttempt> {
	const data = await apiClient.get<unknown>(
		connectorGenerationsRoutes.attempt(attemptId),
	);
	return connectorGenerationAttemptSchema.parse(data);
}
