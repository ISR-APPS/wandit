// Builds the rows of the guests page: each guest with the stays, the totals, and the presence.
// guests.queries.ts calls it. A real app can get the same rows from one select with an embedded relation.
// guestKindOf gives the kind column and the kind filter of the guests page.
import {
	addDays,
	type Guest,
	type Reservation,
	type ReservationStatus,
	type Room,
	startOfLocalDay,
	toIsoDay,
} from "~/features/hotel";

/** Where a guest is now, in the order of the list. Its label is the message key `guests.presence.<presence>`. */
export const GUEST_PRESENCES = [
	"in_house",
	"arriving",
	"upcoming",
	"past",
] as const;

/** `arriving` has a stay that starts in the next 7 days. `upcoming` has a stay after that. */
export type GuestPresence = (typeof GUEST_PRESENCES)[number];

/** One stay in the history of a guest. */
export type GuestStay = {
	/** Id of the reservation. Also the last part of its detail URL. */
	reservationId: string;
	code: string;
	/** The number on the door. */
	roomNumber: string;
	/** `YYYY-MM-DD`. */
	checkIn: string;
	/** `YYYY-MM-DD`. */
	checkOut: string;
	nights: number;
	status: ReservationStatus;
	/** Sum of the folio, in whole units of the hotel currency. */
	total: number;
};

/** One guest of the list. */
export type GuestRow = Guest & {
	presence: GuestPresence;
	/** Stays that started, with the stays before the sample book. A booking to come is not a stay yet. */
	stayCount: number;
	/** Sum of the folios of the stays that started, with the earlier spend. */
	lifetimeSpend: number;
	/** The room of the guest now. null when the guest is not in the house. */
	roomNumber: string | null;
	/** Arrival day of the next stay, `YYYY-MM-DD`, or null. */
	nextCheckIn: string | null;
	/** Departure day of the last finished stay, `YYYY-MM-DD`, or null. */
	lastCheckOut: string | null;
	/** The reservations of the guest in the sample book, newest arrival first. */
	stays: GuestStay[];
};

/** How well the hotel knows a guest. Its label is the message key `guests.kinds.<kind>`. */
export const GUEST_KINDS = ["first", "returning", "regular"] as const;

/** One guest kind: 0 or 1 stay is "first", 2 to 4 stays "returning", 5 or more "regular". */
export type GuestKind = (typeof GUEST_KINDS)[number];

// From 2 stays, a guest is a returning guest. From 5 stays, the desk greets the guest as a regular.
const RETURNING_STAYS = 2;
const REGULAR_STAYS = 5;

/** The kind of a guest from the count of stays that started. */
export function guestKindOf(guest: Pick<GuestRow, "stayCount">): GuestKind {
	return guest.stayCount >= REGULAR_STAYS
		? "regular"
		: guest.stayCount >= RETURNING_STAYS
			? "returning"
			: "first";
}

// A stay in the next 7 days is "arriving". The desk prepares these arrivals.
const ARRIVING_DAYS = 7;

/** The rows at `now` (milliseconds since 1970). A guest with no reservation in the book gets no row. */
export function buildGuestRows(
	guests: Guest[],
	reservations: Reservation[],
	rooms: Room[],
	now: number,
): GuestRow[] {
	const arrivingUntil = toIsoDay(addDays(startOfLocalDay(now), ARRIVING_DAYS));
	const roomNumbers = new Map(rooms.map((room) => [room.id, room.number]));

	return guests
		.map((guest): GuestRow | null => {
			const own = reservations
				.filter((reservation) => reservation.guestId === guest.id)
				.sort((first, second) => second.checkIn.localeCompare(first.checkIn));
			if (own.length === 0) {
				return null;
			}
			const kept = own.filter(
				(reservation) =>
					reservation.status !== "cancelled" &&
					reservation.status !== "no_show",
			);
			const inHouse = kept.find(
				(reservation) => reservation.status === "checked_in",
			);
			// `own` is newest first, so the last match is the nearest arrival.
			const next = kept
				.filter(
					(reservation) =>
						reservation.status === "confirmed" ||
						reservation.status === "pending",
				)
				.at(-1);
			const last = kept.find(
				(reservation) => reservation.status === "checked_out",
			);
			// `YYYY-MM-DD` texts compare in date order.
			const presence: GuestPresence = inHouse
				? "in_house"
				: next
					? next.checkIn <= arrivingUntil
						? "arriving"
						: "upcoming"
					: "past";
			// The count and the spend use the same stays: the ones whose guest arrived.
			const started = kept.filter(
				(reservation) => reservation.arrivedAt !== null,
			);
			return {
				...guest,
				presence,
				stayCount: guest.earlierStays + started.length,
				lifetimeSpend:
					guest.earlierSpend +
					started.reduce((sum, reservation) => sum + reservation.total, 0),
				roomNumber: inHouse ? (roomNumbers.get(inHouse.roomId) ?? null) : null,
				nextCheckIn: next?.checkIn ?? null,
				lastCheckOut: last?.checkOut ?? null,
				stays: own.map((reservation) => ({
					reservationId: reservation.id,
					code: reservation.code,
					roomNumber: roomNumbers.get(reservation.roomId) ?? "",
					checkIn: reservation.checkIn,
					checkOut: reservation.checkOut,
					nights: reservation.nights,
					status: reservation.status,
					total: reservation.total,
				})),
			};
		})
		.filter((row) => row !== null)
		.sort(
			(first, second) =>
				GUEST_PRESENCES.indexOf(first.presence) -
					GUEST_PRESENCES.indexOf(second.presence) ||
				first.fullName.localeCompare(second.fullName),
		);
}
