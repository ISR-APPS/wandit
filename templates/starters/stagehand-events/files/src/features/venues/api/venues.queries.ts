// Reads of the venues page: every venue with its events, and the four KPIs of the page.
// The /app/venues loader prefetches both. The page reads them with useSuspenseQuery.
// Each queryFn reads the sample box office. A later turn replaces each body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import { loadBoxOffice } from "~/features/organiser";
import { buildVenueKpis, buildVenueRows } from "../lib/venue-rows";

/** Every venue with its events. The key has no filter: the page filters and sorts in the browser. */
export function venuesQueryOptions() {
	return queryOptions({
		queryKey: ["venues", "list"],
		queryFn: async () => buildVenueRows(loadBoxOffice(Date.now())),
	});
}

/** The KPI row of the venues page: the next 30 days against the last 30 days. */
export function venueKpisQueryOptions() {
	return queryOptions({
		queryKey: ["venues", "kpis"],
		queryFn: async () => buildVenueKpis(loadBoxOffice(Date.now())),
	});
}
