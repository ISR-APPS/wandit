// Reads of the header alerts: the bookings that wait for their deposit, and the rooms out of order.
// HeaderNotifications reads it after the shell renders. The bell counts the same bookings as the
// "Awaiting deposit" filter of the reservations list, because both read the `pending` status.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { toIsoDay } from "../lib/hotel-day";
import { listGuests } from "../lib/sample-guests";
import { listReservations } from "../lib/sample-reservations";
import { listRooms } from "../lib/sample-rooms";

// A deposit alert opens its reservation. linkOptions types the path, so a wrong path fails typecheck.
function reservationLink(reservationId: string) {
	return linkOptions({
		to: "/app/reservations/$reservationId",
		params: { reservationId },
	});
}

// A room alert opens the housekeeping board, where the repair task of the room is.
const housekeepingLink = linkOptions({ to: "/app/housekeeping" });

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "missingDeposit": a booking with no deposit yet. "roomClosed": a room that the desk cannot sell. */
	kind: "missingDeposit" | "roomClosed";
	/** The guest name, or the reason of the closure as the desk wrote it. */
	title: string;
	/** The booking code, or the number on the door of the closed room. */
	detail: string;
	/** ISO time: the booking time, or the time when the room closed. */
	at: string;
	link: ReturnType<typeof reservationLink> | typeof housekeepingLink;
};

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const guests = new Map(
				listGuests(now).map((guest) => [guest.id, guest.fullName]),
			);
			const missingDeposits: Alert[] = listReservations(now)
				.filter((reservation) => reservation.status === "pending")
				.map((reservation) => ({
					id: reservation.id,
					kind: "missingDeposit",
					title: guests.get(reservation.guestId) ?? reservation.code,
					detail: reservation.code,
					at: reservation.bookedAt,
					link: reservationLink(reservation.id),
				}));
			const today = toIsoDay(now);
			// A room is closed from its `since` time to the start of its `until` day.
			const closedRooms: Alert[] = listRooms(now).flatMap((room) =>
				room.outOfOrder &&
				Date.parse(room.outOfOrder.since) <= now &&
				room.outOfOrder.until > today
					? [
							{
								id: room.id,
								kind: "roomClosed" as const,
								title: room.outOfOrder.reason,
								detail: room.number,
								at: room.outOfOrder.since,
								link: housekeepingLink,
							},
						]
					: [],
			);
			return [...missingDeposits, ...closedRooms].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
