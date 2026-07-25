// TanStack Query keys + polling for the Marketing tab. The list polls only
// while at least one asset is still queued/generating, so an idle tab makes
// no background requests.

import { useQuery } from "@tanstack/react-query";

import {
	getMarketingAssetHtml,
	listMarketingAssets,
} from "./marketing-assets.services";

export const marketingAssetKeys = {
	all: ["marketing-assets"] as const,
	list: (projectId: string) =>
		[...marketingAssetKeys.all, "list", projectId] as const,
	html: (assetId: string) =>
		[...marketingAssetKeys.all, "html", assetId] as const,
};

export function useMarketingAssetsQuery(projectId: string) {
	return useQuery({
		queryKey: marketingAssetKeys.list(projectId),
		queryFn: () => listMarketingAssets(projectId),
		refetchInterval: (query) => {
			if (query.state.error) return false;

			const assets = query.state.data;
			const working = assets?.some(
				(asset) => asset.status === "queued" || asset.status === "generating",
			);
			return working ? 2500 : false;
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
