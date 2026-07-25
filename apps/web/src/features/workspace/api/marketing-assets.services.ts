// Raw async functions for marketing assets — NO React in here. Responses are
// parsed with the @wandit/contracts Zod schemas at this boundary so a drifted
// server payload fails loudly here instead of as undefined in a card.

import {
	type MarketingAsset,
	type MarketingAssetHtmlResponse,
	marketingAssetHtmlResponseSchema,
	marketingAssetsResponseSchema,
	marketingAssetsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";
import { getServerUrl } from "@/lib/server-url";

/** Every marketing asset card of one owned project, newest first. */
export async function listMarketingAssets(
	projectId: string,
): Promise<MarketingAsset[]> {
	const data = await apiClient.get<unknown>(
		marketingAssetsRoutes.list(projectId),
	);
	return marketingAssetsResponseSchema.parse(data).assets;
}

/** One finished asset's HTML document (JSON envelope → sandboxed iframe). */
export async function getMarketingAssetHtml(
	assetId: string,
): Promise<MarketingAssetHtmlResponse> {
	const data = await apiClient.get<unknown>(
		marketingAssetsRoutes.html(assetId),
	);
	return marketingAssetHtmlResponseSchema.parse(data);
}

/**
 * Direct href for the HTML download — a plain navigation, not an XHR: the
 * endpoint answers with Content-Disposition and the auth cookie rides the
 * same-site request (same pattern as lead-scrape downloads).
 */
export function marketingAssetDownloadUrl(assetId: string): string {
	return `${getServerUrl().replace(/\/$/, "")}${marketingAssetsRoutes.download(assetId)}`;
}
