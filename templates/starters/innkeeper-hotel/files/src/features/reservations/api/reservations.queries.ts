// Reads of reservations: the list, one reservation with its folio, and the rooms of the calendar.
// The list and detail routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn returns sample rows of ~/features/hotel. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type FolioCharge,
	type Guest,
	listFolioCharges,
	listGuests,
	listPayments,
	listReservations,
	listRooms,
	type Payment,
	type Reservation,
	type Room,
	type RoomType,
	toIsoDay,
} from "~/features/hotel";
import { buildStayTimeline, type TimelineStep } from "../lib/stay-timeline";

/** One reservation with the names that the list shows: a row of `reservations` joined to its guest and its room. */
export type ReservationRow = Reservation & {
	guestName: string;
	/** The number on the door, for example "204". */
	roomNumber: string;
	roomType: RoomType;
	/** What the guest still owes, in whole units of the hotel currency. 0 for a stay that did not happen. */
	balance: number;
};

/** Everything that the detail page shows for one reservation. */
export type ReservationDetail = {
	reservation: ReservationRow;
	guest: Guest;
	/** Count of the stays of this guest that started, with the earlier stays. 0 for a first booking to come. */
	guestStayCount: number;
	room: Room;
	charges: FolioCharge[];
	payments: Payment[];
	timeline: TimelineStep[];
};

function toRow(
	reservation: Reservation,
	guests: Guest[],
	rooms: Room[],
): ReservationRow {
	const room = rooms.find((candidate) => candidate.id === reservation.roomId);
	const didNotHappen =
		reservation.status === "cancelled" || reservation.status === "no_show";
	return {
		...reservation,
		guestName:
			guests.find((guest) => guest.id === reservation.guestId)?.fullName ?? "",
		roomNumber: room?.number ?? "",
		roomType: room?.type ?? "classic",
		balance: didNotHappen ? 0 : reservation.total - reservation.paid,
	};
}

/**
 * Every reservation. The stays in the house and the stays to come are first, by arrival day.
 * The past stays follow, newest first. The list page searches, sorts, and pages them in the browser.
 */
export function reservationsQueryOptions() {
	return queryOptions({
		queryKey: ["reservations", "list"],
		queryFn: async () => {
			const now = Date.now();
			const today = toIsoDay(now);
			const guests = listGuests(now);
			const rooms = listRooms(now);
			const rows = listReservations(now).map((reservation) =>
				toRow(reservation, guests, rooms),
			);
			// `YYYY-MM-DD` texts compare in date order.
			const isOpen = (row: ReservationRow) =>
				row.status === "checked_in" || row.checkIn >= today;
			return [
				...rows
					.filter(isOpen)
					.sort((first, second) => first.checkIn.localeCompare(second.checkIn)),
				...rows
					.filter((row) => !isOpen(row))
					.sort((first, second) => second.checkIn.localeCompare(first.checkIn)),
			];
		},
	});
}

/** One reservation with its guest, its room, its folio, and its timeline. null when the id does not exist. */
export function reservationQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["reservations", "detail", id],
		queryFn: async (): Promise<ReservationDetail | null> => {
			const now = Date.now();
			const reservations = listReservations(now);
			// The id comes from the URL. An unknown id is "not found", not an error.
			const reservation = reservations.find((candidate) => candidate.id === id);
			const guests = listGuests(now);
			const rooms = listRooms(now);
			const guest = guests.find(
				(candidate) => candidate.id === reservation?.guestId,
			);
			const room = rooms.find(
				(candidate) => candidate.id === reservation?.roomId,
			);
			if (!reservation || !guest || !room) {
				return null;
			}
			const payments = listPayments(id, now);
			return {
				reservation: toRow(reservation, guests, rooms),
				guest,
				guestStayCount:
					guest.earlierStays +
					reservations.filter(
						(candidate) =>
							candidate.guestId === guest.id &&
							candidate.status !== "cancelled" &&
							candidate.status !== "no_show" &&
							candidate.arrivedAt !== null,
					).length,
				room,
				charges: listFolioCharges(id, now),
				payments,
				timeline: buildStayTimeline(reservation, payments, now),
			};
		},
	});
}

/** The 18 rooms, by door number. The calendar view draws one row per room. */
export function roomsQueryOptions() {
	return queryOptions({
		queryKey: ["rooms", "list"],
		queryFn: async () => listRooms(Date.now()),
	});
}
