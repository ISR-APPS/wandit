// TanStack Query hooks + keys for lead scraping. Live progress arrives over
// Trigger.dev Realtime (the card subscribes to the run); the interval is the
// guarantee behind it — fast when the card has no usable subscription, slow
// as a safety net while Realtime is healthy (an Electric stream can die
// silently: backgrounded tab, sleep/wake, proxies). It always stops by
// itself once the attempt settles.

import { useQuery } from "@tanstack/react-query";

import { getLeadScrapeAttempt } from "./lead-scrapes.services";

export const leadScrapeKeys = {
	all: ["lead-scrapes"] as const,
	attempt: (attemptId: string) =>
		[...leadScrapeKeys.all, "attempt", attemptId] as const,
};

export function useLeadScrapeAttemptQuery(
	attemptId: string,
	intervalMs = 1200,
) {
	return useQuery({
		queryKey: leadScrapeKeys.attempt(attemptId),
		queryFn: () => getLeadScrapeAttempt(attemptId),
		refetchInterval: (query) => {
			// A failing poll (deleted attempt, auth loss) must not loop forever.
			if (query.state.error) return false;

			const status = query.state.data?.status;
			// Poll only while the scrape is actually in flight (or unknown).
			return status === undefined || status === "queued" || status === "running"
				? intervalMs
				: false;
		},
	});
}
