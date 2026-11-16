// Reads of the practitioners page: the team with the figures of today, and the visits by kind.
// The /app/practitioners route prefetches them in its loader. The page reads them with useSuspenseQuery.
// Each queryFn returns sample rows of ~/features/clinic. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	LIVE_REFETCH_MS,
	listAppointmentRows,
	listPractitioners,
	startOfMinute,
} from "~/features/clinic";
import {
	buildPractitionerRows,
	buildVisitTypeBreakdown,
} from "../lib/practitioner-rows";

/** Every practitioner with the day, the next patient, and the visits of the last 30 days, in the order of the rooms. */
export function practitionersQueryOptions() {
	return queryOptions({
		queryKey: ["practitioners", "list"],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			return buildPractitionerRows(
				listPractitioners(),
				listAppointmentRows(now),
				now,
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** Visits done in the last 30 days by kind of visit, the largest first. Feeds the breakdown panel. */
export function visitsByTypeQueryOptions() {
	return queryOptions({
		queryKey: ["visits", "by-type"],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			return buildVisitTypeBreakdown(listAppointmentRows(now), now);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
