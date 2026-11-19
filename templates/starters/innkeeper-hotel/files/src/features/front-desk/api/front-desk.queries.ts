// Reads of the front desk home: the summary of today, the occupancy of one week, and the revenue of one period.
// The /app route prefetches the summary and the first choices in its loader. The cards read them with useSuspenseQuery.
// A Select or a tab of a card puts its value into the query key, so a new choice reads new figures.
// Each queryFn reads the sample tables of ~/features/hotel. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	listFolioCharges,
	listGuests,
	listReservations,
	listRooms,
} from "~/features/hotel";
import {
	buildChannelSplits,
	buildDeskEvents,
	buildKpis,
	buildMovements,
	buildOccupancy,
	buildReservationMix,
	buildRevenue,
	type OccupancyWeek,
	type RevenueCharge,
	type RevenuePeriod,
} from "../lib/home-figures";

/** 60 s. Guests arrive and leave during the day, so the tiles and the table follow the clock. */
const LIVE_REFETCH_MS = 60_000;

/** The desk feed shows the newest events only. */
const FEED_EVENTS = 4;

/** The KPI tiles, the status donut, the desk feed, the channel split, and the movements of today and tomorrow. */
export function frontDeskQueryOptions() {
	return queryOptions({
		queryKey: ["front-desk", "summary"],
		queryFn: async () => {
			const now = Date.now();
			const reservations = listReservations(now);
			const rooms = listRooms(now);
			const guests = listGuests(now);
			return {
				now,
				kpis: buildKpis(reservations, rooms, now),
				mix: buildReservationMix(reservations, now),
				events: buildDeskEvents(reservations, guests, rooms, now).slice(
					0,
					FEED_EVENTS,
				),
				channels: buildChannelSplits(reservations, now),
				movements: buildMovements(reservations, guests, rooms, now),
			};
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** The booked and available rooms of each night of one week: -1 is last week, 0 this week, 1 next week. */
export function occupancyQueryOptions(week: OccupancyWeek) {
	return queryOptions({
		queryKey: ["front-desk", "occupancy", week],
		queryFn: async () => {
			const now = Date.now();
			return buildOccupancy(listReservations(now), listRooms(now), now, week);
		},
	});
}

/** The room and extras revenue of the last 7 days by day, or of the last 4 weeks by week. */
export function revenueQueryOptions(period: RevenuePeriod) {
	return queryOptions({
		queryKey: ["front-desk", "revenue", period],
		queryFn: async () => {
			const now = Date.now();
			const charges: RevenueCharge[] = listReservations(now)
				.filter(
					(reservation) =>
						reservation.status === "checked_in" ||
						reservation.status === "checked_out",
				)
				.flatMap((reservation) =>
					listFolioCharges(reservation.id, now).map((charge) => ({
						kind: charge.kind,
						postedOn: charge.postedOn,
						amount: charge.amount,
						quantity: charge.quantity,
						checkIn: reservation.checkIn,
						nights: reservation.nights,
					})),
				);
			return buildRevenue(charges, now, period);
		},
	});
}
