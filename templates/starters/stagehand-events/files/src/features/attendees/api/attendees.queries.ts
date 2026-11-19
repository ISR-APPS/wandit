// Reads of the attendees page: every order of every event, with its door status.
// The /app/attendees loader prefetches it. The page reads it with useSuspenseQuery.
// The queryFn reads the sample box office. A later turn replaces its body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import { loadBoxOffice } from "~/features/organiser";
import { buildGuestRows } from "../lib/guest-rows";

/** Every guest row, the latest activity first. The key has no filter: the page filters in the browser. */
export function guestsQueryOptions() {
	return queryOptions({
		queryKey: ["attendees", "list"],
		queryFn: async () => buildGuestRows(loadBoxOffice(Date.now())),
	});
}
