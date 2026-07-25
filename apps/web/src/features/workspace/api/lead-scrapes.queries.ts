// TanStack Query hooks + keys for lead scraping. The attempt is the ONE
// polled entry point: while it is queued/running the card refetches every
// 1.2s, and the interval switches itself off the moment the attempt settles
// (succeeded/failed) or the request errors — TanStack re-evaluates the
// refetchInterval callback after every fetch.

import { useQuery } from "@tanstack/react-query";

import { getLeadScrapeAttempt } from "./lead-scrapes.services";

export const leadScrapeKeys = {
	all: ["lead-scrapes"] as const,
	attempt: (attemptId: string) =>
		[...leadScrapeKeys.all, "attempt", attemptId] as const,
};

export function useLeadScrapeAttemptQuery(attemptId: string) {
	return useQuery({
		queryKey: leadScrapeKeys.attempt(attemptId),
		queryFn: () => getLeadScrapeAttempt(attemptId),
		refetchInterval: (query) => {
			// A failing poll (deleted attempt, auth loss) must not loop forever.
			if (query.state.error) return false;

			const status = query.state.data?.status;
			// Poll only while the scrape is actually in flight (or unknown).
			return status === undefined || status === "queued" || status === "running"
				? 1200
				: false;
		},
	});
}
