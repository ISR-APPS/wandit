// Reads of the guest list: the events that have one, and the orders of one event.
// The /app/attendees loader prefetches both. The page reads them with useSuspenseQuery.
// Each queryFn reads the sample box office. A later turn replaces each body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import { loadBoxOffice } from "~/features/organiser";
import { buildGuestRows, guestListEvents } from "../lib/guest-rows";

/** The events of the picker. The first one is the default: a live event, else the next one. */
export function guestListEventsQueryOptions() {
	return queryOptions({
		queryKey: ["attendees", "events"],
		queryFn: async () => guestListEvents(loadBoxOffice(Date.now())),
	});
}

/** The guest list of one event, or null when the id has no guest list. */
export function guestListQueryOptions(eventId: string) {
	return queryOptions({
		queryKey: ["attendees", "list", eventId],
		queryFn: async () => {
			const box = loadBoxOffice(Date.now());
			const event = guestListEvents(box).find((row) => row.id === eventId);
			if (!event) {
				return null;
			}
			return { event, rows: buildGuestRows(box, event), now: box.now };
		},
	});
}
