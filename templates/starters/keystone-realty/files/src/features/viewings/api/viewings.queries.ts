// Reads of viewings: the full list. The viewings route and the home route prefetch it in their loaders.
// The pages read it with useSuspenseQuery. The queryFn returns sample rows of ~/features/agency.
// To make it real: replace the body of the queryFn with a Supabase select with the lead and the listing joined.
import { queryOptions } from "@tanstack/react-query";
import { readViewingRows } from "~/features/agency";

/** Every viewing, by start time, oldest first. The agenda and the tables filter them in the browser. */
export function viewingsQueryOptions() {
	return queryOptions({
		queryKey: ["viewings", "list"],
		queryFn: async () => readViewingRows(Date.now()),
	});
}
