// TanStack Query hooks + keys for connector generations. Live progress
// arrives over Trigger.dev Realtime (the card subscribes to the run); the
// interval is the guarantee behind it — fast when the card has no usable
// subscription, slow as a safety net while Realtime is healthy (an Electric
// stream can die silently: backgrounded tab, sleep/wake, proxies). It always
// stops by itself once the attempt settles.

import { useQuery } from "@tanstack/react-query";

import { getConnectorGenerationAttempt } from "./connector-generations.services";

export const connectorGenerationKeys = {
	all: ["connector-generations"] as const,
	attempt: (attemptId: string) =>
		[...connectorGenerationKeys.all, "attempt", attemptId] as const,
};

export function useConnectorGenerationAttemptQuery(
	attemptId: string,
	intervalMs: number,
) {
	return useQuery({
		queryKey: connectorGenerationKeys.attempt(attemptId),
		queryFn: () => getConnectorGenerationAttempt(attemptId),
		refetchInterval: (query) => {
			// A failing poll (deleted attempt, auth loss) must not loop forever.
			if (query.state.error) return false;

			const status = query.state.data?.status;
			return status === undefined || status === "queued" || status === "running"
				? intervalMs
				: false;
		},
	});
}
