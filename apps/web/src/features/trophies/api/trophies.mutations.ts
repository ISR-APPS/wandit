/**
 * TanStack mutation of the trophies feature. TrophyUnlockToaster calls it after it shows the unlock toasts.
 * It calls trophies.services.ts and writes the result into the trophies query cache.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TrophiesResponse } from "@wandit/contracts";

import { trophiesKeys } from "./trophies.queries";
import { markTrophiesSeen } from "./trophies.services";

/**
 * Posts the ids of the trophies that the user saw. On success it clears `isNew` in the cache,
 * so a refetch is not necessary. On error the trophies stay new, and the next session shows them again.
 */
export function useMarkTrophiesSeen() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...trophiesKeys.all, "seen"],
		mutationFn: markTrophiesSeen,
		onSuccess: (_data, body) => {
			const seenIds = new Set(body.trophyIds);
			queryClient.setQueryData<TrophiesResponse>(
				trophiesKeys.list(),
				(current) =>
					current && {
						...current,
						trophies: current.trophies.map((trophy) =>
							seenIds.has(trophy.id) ? { ...trophy, isNew: false } : trophy,
						),
					},
			);
		},
	});
}
