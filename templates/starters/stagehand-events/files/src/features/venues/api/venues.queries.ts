// Reads of the venues page: every venue with its events to come and its recent events.
// The /app/venues loader prefetches it. The page reads it with useSuspenseQuery.
// The queryFn reads the sample box office. A later turn replaces its body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import { loadBoxOffice } from "~/features/organiser";
import { buildVenueRows } from "../lib/venue-rows";

/** Every venue with its events. The key has no filter: the page filters and sorts in the browser. */
export function venuesQueryOptions() {
	return queryOptions({
		queryKey: ["venues", "list"],
		queryFn: async () => buildVenueRows(loadBoxOffice(Date.now())),
	});
}
