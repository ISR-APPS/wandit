// Reads of guests: the list with the stays of each guest.
// The /app/guests route prefetches it in its loader. The page and the guest panel read it with useSuspenseQuery.
// The queryFn returns sample rows of ~/features/hotel. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import { listGuests, listReservations, listRooms } from "~/features/hotel";
import { buildGuestRows } from "../lib/guest-rows";

/** Every guest who has a reservation, with the stays, the totals, and where the guest is now. Guests in the house come first. */
export function guestsQueryOptions() {
	return queryOptions({
		queryKey: ["guests", "list"],
		queryFn: async () => {
			const now = Date.now();
			return buildGuestRows(
				listGuests(now),
				listReservations(now),
				listRooms(now),
				now,
			);
		},
	});
}
