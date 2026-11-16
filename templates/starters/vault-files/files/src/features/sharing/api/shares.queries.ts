// Reads of the Shared page: every share of a live file, newest first, with its state now.
// The /app/shared route prefetches it in its loader. SharedPage reads it with useSuspenseQuery.
// The queryFn reads the sample workspace now. A later turn replaces its body with one Supabase select.
import { queryOptions } from "@tanstack/react-query";
import { readWorkspace } from "~/features/workspace";

/** Every share, expired ones too. The page filters them by state and by audience. */
export function sharesQueryOptions() {
	return queryOptions({
		queryKey: ["shares", "list"],
		queryFn: async () => readWorkspace(Date.now()).shares,
	});
}
