// TanStack Query keys + polling for standalone media generation. An attempt
// is reload-safe: the persisted tool part carries its id and this query
// rebuilds the progress/result card from server state.

import { useQuery } from "@tanstack/react-query";

import { getMediaGenerationAttempt } from "./media-generations.services";

export const mediaGenerationKeys = {
	all: ["media-generations"] as const,
	attempt: (attemptId: string) =>
		[...mediaGenerationKeys.all, "attempt", attemptId] as const,
};

export function useMediaGenerationAttemptQuery(
	attemptId: string,
	// Cards with a Realtime subscription pass a slow safety-net interval and
	// flip to a fast one when the subscription dies (generate_video); the
	// legacy animate_image card keeps the fast default.
	intervalMs = 1500,
) {
	return useQuery({
		queryKey: mediaGenerationKeys.attempt(attemptId),
		queryFn: () => getMediaGenerationAttempt(attemptId),
		refetchInterval: (query) => {
			// Authentication loss or a missing attempt should not create an
			// endless background request loop. The card exposes a manual retry.
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
