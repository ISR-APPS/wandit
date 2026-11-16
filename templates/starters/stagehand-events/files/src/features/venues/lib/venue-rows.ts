// The rows of the venues page: each venue with its events to come and its recent events.
// venues.queries.ts builds them from the box office. The cards and the venue panel read them.
import {
	addDays,
	type BoxOffice,
	type EventSummary,
	startOfLocalDay,
	VENUES,
	type Venue,
} from "~/features/organiser";

/** The window of "recent" events, in days. The average fill and the guest count use it. */
const RECENT_DAYS = 90;

/** One venue with the events that it hosts. */
export type VenueRow = Venue & {
	/** Events that have not ended and are not cancelled, the soonest first. */
	upcoming: EventSummary[];
	/** Events that ended in the last RECENT_DAYS days, the newest first. */
	recent: EventSummary[];
	/** The mean of sold / capacity of the recent events, from 0 to 1. null with no recent event. */
	averageFill: number | null;
	/** Scanned tickets of the recent events. */
	recentGuests: number;
	/** The recent events (oldest first), then the upcoming events. The card draws one fill bar per event. */
	season: EventSummary[];
};

/** Every venue, in the order of VENUES, with its events. */
export function buildVenueRows(box: BoxOffice): VenueRow[] {
	const recentStart = addDays(startOfLocalDay(box.now), -RECENT_DAYS);
	return VENUES.map((venue) => {
		const atVenue = box.events.filter((event) => event.venueId === venue.id);
		const upcoming = atVenue.filter(
			(event) => event.endsAt > box.now && event.status !== "cancelled",
		);
		const recent = atVenue
			.filter(
				(event) => event.status === "completed" && event.endsAt >= recentStart,
			)
			.reverse();
		return {
			...venue,
			upcoming,
			recent,
			averageFill:
				recent.length === 0
					? null
					: recent.reduce(
							(sum, event) => sum + event.sold / event.capacity,
							0,
						) / recent.length,
			recentGuests: recent.reduce((sum, event) => sum + event.checkedIn, 0),
			// The bars use the same window as the figures above them.
			season: [...[...recent].reverse(), ...upcoming],
		};
	});
}
