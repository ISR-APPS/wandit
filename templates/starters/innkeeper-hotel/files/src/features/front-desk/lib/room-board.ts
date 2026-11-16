// Builds the live room board of the home page: one entry per room with its status at this minute.
// front-desk.queries.ts calls `buildRoomBoard` with the rooms, the reservations, and the tasks of today.
// A real app can keep the same function, or move the rules into a database view.
import {
	ATTENDANTS,
	addDays,
	daysBetween,
	type Guest,
	type HousekeepingTask,
	type Reservation,
	type Room,
	startOfLocalDay,
	toIsoDay,
} from "~/features/hotel";

/** Every status of a room, in the order of the status line. Its label is the message key `roomStatuses.<status>`. */
export const ROOM_STATUSES = [
	"occupied",
	"departing",
	"arriving",
	"vacant",
	"cleaning",
	"out_of_order",
] as const;

/**
 * One live status. `departing` has a guest who leaves today. `arriving` is ready for a guest of today.
 * `cleaning` waits for housekeeping after a check-out.
 */
export type RoomStatus = (typeof ROOM_STATUSES)[number];

/** The dot color of each status. A status always shows this dot and its word, never the color alone. */
export const ROOM_STATUS_DOT = {
	occupied: "bg-primary",
	departing: "bg-warning",
	arriving: "bg-info",
	vacant: "bg-success",
	cleaning: "bg-muted-foreground",
	out_of_order: "bg-destructive",
} satisfies Record<RoomStatus, string>;

/** The facts of one stay that a room tile and the room panel show. */
export type RoomStay = {
	/** Id of the reservation. Also the last part of its detail URL. */
	reservationId: string;
	code: string;
	guestName: string;
	/** Adults plus children. */
	guests: number;
	/** `YYYY-MM-DD`. */
	checkIn: string;
	/** `YYYY-MM-DD`. */
	checkOut: string;
	nights: number;
	/** ISO time when the guest plans to arrive. */
	expectedArrivalAt: string;
	/** ISO time when the guest plans to leave. */
	expectedDepartureAt: string;
};

/** One task of today with the name of its attendant, for the room panel. */
export type RoomTask = HousekeepingTask & { attendantName: string };

/** One room of the board. */
export type RoomBoardEntry = {
	room: Room;
	status: RoomStatus;
	/** ISO time of the last status change. */
	changedAt: string;
	/** The live number of the tile: the guests in the room at this minute. 0 for an empty room. */
	guestsInRoom: number;
	/** The stay behind the status: the guest in the room, or the arrival of today. null for an empty room. */
	stay: RoomStay | null;
	/** The night of the stay that starts this evening, from 1. null when no guest is in the room. */
	nightNumber: number | null;
	/**
	 * The stay that starts today when its guest is not in the house yet, or null.
	 * The room can still hold the guest of last night (`departing`) or wait for housekeeping (`cleaning`).
	 */
	arrivalToday: RoomStay | null;
	/** The next arrival after today, or null when the sample book has none. */
	nextArrival: RoomStay | null;
	/** The housekeeping tasks of the room today. */
	tasks: RoomTask[];
};

function toRoomStay(
	reservation: Reservation,
	guests: Map<string, Guest>,
): RoomStay {
	return {
		reservationId: reservation.id,
		code: reservation.code,
		guestName: guests.get(reservation.guestId)?.fullName ?? "",
		guests: reservation.adults + reservation.children,
		checkIn: reservation.checkIn,
		checkOut: reservation.checkOut,
		nights: reservation.nights,
		expectedArrivalAt: reservation.expectedArrivalAt,
		expectedDepartureAt: reservation.expectedDepartureAt,
	};
}

/**
 * The board at `now` (milliseconds since 1970), in the order of `rooms`.
 * `reservations` and `tasks` hold the rows of the same `now`, so each status follows the clock.
 */
export function buildRoomBoard(
	rooms: Room[],
	reservations: Reservation[],
	guests: Guest[],
	tasks: HousekeepingTask[],
	now: number,
): RoomBoardEntry[] {
	const today = toIsoDay(now);
	const todayStartIso = new Date(startOfLocalDay(now)).toISOString();
	const guestsById = new Map(guests.map((guest) => [guest.id, guest]));
	// A cancelled stay and a no-show keep no room.
	const stays = reservations.filter(
		(reservation) =>
			reservation.status !== "cancelled" && reservation.status !== "no_show",
	);

	return rooms.map((room): RoomBoardEntry => {
		const roomStays = stays.filter((stay) => stay.roomId === room.id);
		const departure = roomStays.find((stay) => stay.checkOut === today);
		// `YYYY-MM-DD` texts compare in date order.
		const tonight = roomStays.find(
			(stay) => stay.checkIn <= today && stay.checkOut > today,
		);
		const next = roomStays
			.filter((stay) => stay.checkIn > today)
			.sort((first, second) => first.checkIn.localeCompare(second.checkIn))[0];
		const roomTasks = tasks
			.filter((task) => task.roomId === room.id)
			.map((task) => ({
				...task,
				attendantName:
					ATTENDANTS.find((attendant) => attendant.id === task.attendantId)
						?.fullName ?? "",
			}));
		const departureTask = roomTasks.find((task) => task.kind === "departure");
		const shared = {
			room,
			arrivalToday:
				tonight && tonight.checkIn === today && tonight.status !== "checked_in"
					? toRoomStay(tonight, guestsById)
					: null,
			nextArrival: next ? toRoomStay(next, guestsById) : null,
			tasks: roomTasks,
		};

		if (room.outOfOrder && Date.parse(room.outOfOrder.since) <= now) {
			return {
				...shared,
				status: "out_of_order",
				changedAt: room.outOfOrder.since,
				guestsInRoom: 0,
				stay: null,
				nightNumber: null,
			};
		}
		// The guest of last night is still in the room.
		if (departure && departure.status === "checked_in") {
			return {
				...shared,
				status: "departing",
				changedAt: todayStartIso,
				guestsInRoom: departure.adults + departure.children,
				stay: toRoomStay(departure, guestsById),
				nightNumber: departure.nights,
			};
		}
		// The guest left, and housekeeping did not finish the room.
		if (departure && departureTask && departureTask.status !== "done") {
			return {
				...shared,
				status: "cleaning",
				changedAt: departure.departedAt ?? todayStartIso,
				guestsInRoom: 0,
				stay: tonight ? toRoomStay(tonight, guestsById) : null,
				nightNumber: null,
			};
		}
		if (tonight && tonight.status !== "checked_in") {
			return {
				...shared,
				status: "arriving",
				changedAt: departureTask?.doneAt ?? todayStartIso,
				guestsInRoom: 0,
				stay: toRoomStay(tonight, guestsById),
				nightNumber: null,
			};
		}
		if (tonight) {
			return {
				...shared,
				status: "occupied",
				changedAt: tonight.arrivedAt ?? todayStartIso,
				guestsInRoom: tonight.adults + tonight.children,
				stay: toRoomStay(tonight, guestsById),
				// The night of the check-in day is night 1.
				nightNumber: daysBetween(tonight.checkIn, today) + 1,
			};
		}
		return {
			...shared,
			status: "vacant",
			changedAt: departureTask?.doneAt ?? todayStartIso,
			guestsInRoom: 0,
			stay: null,
			nightNumber: null,
		};
	});
}

/** The statuses that the alert list shows: a room that the desk cannot give to a guest now. */
const ALERT_STATUSES: readonly RoomStatus[] = ["out_of_order", "cleaning"];
/** The alert list shows at most this many rooms. */
const MAX_ALERTS = 6;

/** The rooms in an alert status, newest change first, at most 6. */
export function roomAlerts(board: RoomBoardEntry[]): RoomBoardEntry[] {
	return board
		.filter((entry) => ALERT_STATUSES.includes(entry.status))
		.sort((first, second) => second.changedAt.localeCompare(first.changedAt))
		.slice(0, MAX_ALERTS);
}

/** Order of two arrivals: the earlier planned arrival time first. ISO times compare in time order. */
function byArrivalTime(first: RoomStay | null, second: RoomStay | null) {
	return (first?.expectedArrivalAt ?? "").localeCompare(
		second?.expectedArrivalAt ?? "",
	);
}

/**
 * The rooms with an arrival of today that is not in the house yet, next arrival first.
 * The room can be ready, in cleaning, or still in use by the guest of last night.
 */
export function pendingArrivals(board: RoomBoardEntry[]): RoomBoardEntry[] {
	return board
		.filter((entry) => entry.arrivalToday !== null)
		.sort((first, second) =>
			byArrivalTime(first.arrivalToday, second.arrivalToday),
		);
}

/**
 * The rooms whose next arrival is the day after `now` (milliseconds since 1970), first arrival first.
 * The arrivals card shows them when every guest of today is in the house.
 */
export function arrivalsTomorrow(
	board: RoomBoardEntry[],
	now: number,
): RoomBoardEntry[] {
	const tomorrow = toIsoDay(addDays(startOfLocalDay(now), 1));
	return board
		.filter((entry) => entry.nextArrival?.checkIn === tomorrow)
		.sort((first, second) =>
			byArrivalTime(first.nextArrival, second.nextArrival),
		);
}
