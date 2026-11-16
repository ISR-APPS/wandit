// Reads of the appointments page: every appointment of the book with patient and practitioner.
// The /app/appointments route prefetches it in its loader. The page reads it with useSuspenseQuery.
// The queryFn returns sample rows of ~/features/clinic. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	LIVE_REFETCH_MS,
	listAppointmentRows,
	startOfMinute,
} from "~/features/clinic";

/** Every appointment, oldest first. The page filters by day, period, and practitioner in the browser. */
export function appointmentsQueryOptions() {
	return queryOptions({
		queryKey: ["appointments", "list"],
		// LIMIT: the whole book (about 2,600 rows) loads at once. Upgrade: server paging (tables-paging.md of the app-dashboard skill).
		queryFn: async () => listAppointmentRows(startOfMinute(Date.now())),
		refetchInterval: LIVE_REFETCH_MS,
	});
}
