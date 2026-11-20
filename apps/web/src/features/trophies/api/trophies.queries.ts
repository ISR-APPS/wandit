/**
 * TanStack query of the trophies feature. The unlock toaster, the summary card, the trophies page,
 * and the level pill of the credits chip read it. It calls trophies.services.ts.
 */
import { useQuery } from "@tanstack/react-query";

import { getTrophies } from "./trophies.services";

/** Query keys of this feature. Trophies belong to the user, not to a workspace, so no key holds a workspace id. */
export const trophiesKeys = {
	all: ["trophies"] as const,
	list: () => [...trophiesKeys.all, "list"] as const,
};

// LIMIT: no event refreshes this query, so a new trophy shows on the next read.
// The page and the summary card read on each mount. Other views read after 2 minutes.
// Upgrade: invalidate trophiesKeys after a publish and a project create.
const TROPHIES_STALE_TIME_MS = 2 * 60_000;

/** The trophies of the signed-in user. The answer is the same in every workspace. */
export function useTrophiesQuery(
	options: {
		/** "always" reads again on each mount, for the views whose job is to show the newest state. */
		refetchOnMount?: "always";
	} = {},
) {
	return useQuery({
		queryKey: trophiesKeys.list(),
		queryFn: getTrophies,
		staleTime: TROPHIES_STALE_TIME_MS,
		refetchOnMount: options.refetchOnMount,
	});
}
