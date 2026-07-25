// TanStack Query keys + polling for standalone image generation. An attempt
// is reload-safe: the persisted tool part carries its id and this query
// rebuilds the progress/result grid from server state.

import { useQuery } from "@tanstack/react-query";

import { getImageGenerationAttempt } from "./image-generations.services";

export const imageGenerationKeys = {
	all: ["image-generations"] as const,
	attempt: (attemptId: string) =>
		[...imageGenerationKeys.all, "attempt", attemptId] as const,
};

export function useImageGenerationAttemptQuery(attemptId: string) {
	return useQuery({
		queryKey: imageGenerationKeys.attempt(attemptId),
		queryFn: () => getImageGenerationAttempt(attemptId),
		refetchInterval: (query) => {
			// Authentication loss or a missing attempt should not create an
			// endless background request loop. The card exposes a manual retry.
			if (query.state.error) return false;

			const status = query.state.data?.status;
			return status === undefined ||
				status === "queued" ||
				status === "generating"
				? 1500
				: false;
		},
	});
}
