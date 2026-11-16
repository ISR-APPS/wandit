// Reads of leads: the full list. The leads route and the home route prefetch it in their loaders.
// The pages read it with useSuspenseQuery. The queryFn returns sample rows of ~/features/agency.
// To make it real: replace the body of the queryFn with a Supabase select, newest first, with a limit of 1,000.
import { queryOptions } from "@tanstack/react-query";
import { readLeadRows } from "~/features/agency";

/** Every lead, newest first. The leads page filters, searches, sorts, and pages them in the browser. */
export function leadsQueryOptions() {
	return queryOptions({
		queryKey: ["leads", "list"],
		queryFn: async () => readLeadRows(Date.now()),
	});
}
