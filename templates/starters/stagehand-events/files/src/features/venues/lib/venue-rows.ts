// The rows of the venues page: each venue with its events to come and its recent events, and the four KPIs.
// venues.queries.ts builds them from the box office. The KPI row, the table, and the venue panel read them.
import {
	addDays,
	type BoxOffice,
	DAY_MS,
	type EventSummary,
	startOfLocalDay,
	VENUES,
	type Venue,
} from "~/features/organiser";

/** The window of "recent" events, in days. The average fill and the guest count use it. */
const RECENT_DAYS = 90;

/** The window of the Booking column, in days. Two weeks shows which venues need an event soon. */
const BOOKING_WINDOW_DAYS = 14;

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
	/** True when an event starts in the next BOOKING_WINDOW_DAYS days, or is on now. */
	isBookedSoon: boolean;
	/** The recent events (oldest first), then the upcoming events. The panel draws one fill bar per event. */
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
			isBookedSoon: upcoming.some(
				(event) => event.startsAt < box.now + BOOKING_WINDOW_DAYS * DAY_MS,
			),
			// The bars use the same window as the figures above them.
			season: [...[...recent].reverse(), ...upcoming],
		};
	});
}

/** The window of the KPI row, in days: the days ahead against the same number of days before. */
export const KPI_WINDOW_DAYS = 30;

/** One KPI of the venues page. */
export type VenueKpi = {
	/** Stable id, also the message key `venues.kpis.<id>`. */
	id: "seats" | "events" | "fill" | "hireFees";
	value: number;
	/** Ratio against the 30 days before: 0.12 is +12 %. null when the earlier window has no data. */
	change: number | null;
};

function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/**
 * The KPI row: seats on offer, events booked, average fill, and hire fees.
 * The next 30 days compare with the last 30 days. Cancelled events are out.
 */
export function buildVenueKpis(box: BoxOffice): VenueKpi[] {
	const windowMs = KPI_WINDOW_DAYS * DAY_MS;
	const live = box.events.filter((event) => event.status !== "cancelled");
	const ahead = live.filter(
		(event) => event.startsAt >= box.now && event.startsAt < box.now + windowMs,
	);
	const before = live.filter(
		(event) => event.startsAt < box.now && event.startsAt >= box.now - windowMs,
	);
	const seats = (events: EventSummary[]) =>
		events.reduce((sum, event) => sum + event.capacity, 0);
	const sold = (events: EventSummary[]) =>
		events.reduce((sum, event) => sum + event.sold, 0);
	const fees = (events: EventSummary[]) =>
		events.reduce((sum, event) => sum + event.venue.hireFeePerDay, 0);
	const fill = (events: EventSummary[]) =>
		seats(events) === 0 ? 0 : sold(events) / seats(events);
	return [
		{
			id: "seats",
			value: seats(ahead),
			change: changeRatio(seats(ahead), seats(before)),
		},
		{
			id: "events",
			value: ahead.length,
			change: changeRatio(ahead.length, before.length),
		},
		{
			id: "fill",
			value: fill(ahead),
			change: changeRatio(fill(ahead), fill(before)),
		},
		{
			id: "hireFees",
			value: fees(ahead),
			change: changeRatio(fees(ahead), fees(before)),
		},
	];
}
