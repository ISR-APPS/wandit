// TanStack Query keys + polling for standalone image generation. An attempt
// is reload-safe: the persisted tool part carries its id and this query
// rebuilds the progress/result grid from server state.

import { type QueryClient, useQuery } from "@tanstack/react-query";
import type { ImageGenerationAttempt } from "@wandit/contracts";

import { workspaceAssetKeys } from "@/features/assets/api/workspace-assets.queries";
import { getImageGenerationAttempt } from "./image-generations.services";
import { pageKeys } from "./pages.queries";
import { projectAssetKeys } from "./project-assets.queries";

export const imageGenerationKeys = {
	all: ["image-generations"] as const,
	attempt: (attemptId: string) =>
		[...imageGenerationKeys.all, "attempt", attemptId] as const,
};

export function imageGenerationPollingInterval(
	attempt: ImageGenerationAttempt | undefined,
): 1500 | false {
	const status = attempt?.status;

	return status === undefined ||
		status === "queued" ||
		status === "generating" ||
		(status === "succeeded" && attempt?.placement?.status === "pending")
		? 1500
		: false;
}

export function invalidateCompletedImageGeneration(
	queryClient: Pick<QueryClient, "invalidateQueries">,
	projectId: string,
	placementStatus:
		| NonNullable<ImageGenerationAttempt["placement"]>["status"]
		| undefined,
): void {
	void queryClient.invalidateQueries({
		queryKey: projectAssetKeys.list(projectId),
	});
	// The dashboard Assets page aggregates every project — new media must
	// surface there too, whatever workspace the cache was scoped to.
	void queryClient.invalidateQueries({
		queryKey: workspaceAssetKeys.all,
	});

	if (placementStatus !== "applied") {
		return;
	}

	void queryClient.invalidateQueries({
		queryKey: pageKeys.overview(projectId),
	});
	void queryClient.invalidateQueries({
		queryKey: pageKeys.versions(projectId),
	});
}

export function useImageGenerationAttemptQuery(attemptId: string) {
	return useQuery({
		queryKey: imageGenerationKeys.attempt(attemptId),
		queryFn: () => getImageGenerationAttempt(attemptId),
		refetchInterval: (query) => {
			// Authentication loss or a missing attempt should not create an
			// endless background request loop. The card exposes a manual retry.
			if (query.state.error) return false;

			return imageGenerationPollingInterval(query.state.data);
		},
	});
}
