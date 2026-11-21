// Reads of the practitioners page: the team with the figures of today and of the last 30 days.
// The /app/practitioners route prefetches it in its loader. The page reads it with useSuspenseQuery.
// Each queryFn returns sample rows of ~/features/clinic. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	LIVE_REFETCH_MS,
	listAppointmentRows,
	listPractitioners,
	startOfMinute,
} from "~/features/clinic";
import { buildPractitionerRows } from "../lib/practitioner-rows";

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
