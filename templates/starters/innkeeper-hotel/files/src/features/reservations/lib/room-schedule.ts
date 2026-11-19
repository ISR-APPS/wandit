// Places the reservations in the cells of the room schedule: one row per night, one column per room.
// RoomSchedule calls buildSchedule with the list rows, the rooms, and the first night of the window.
// A stay shows in the cell of its arrival night. The first row also shows the stays that arrived before it.
import {
	addDays,
	isoDayToMs,
	type ReservationStatus,
	type Room,
	toIsoDay,
} from "~/features/hotel";
import type { ReservationRow } from "../api/reservations.queries";

/** Nights per window: one week, as the 7 time rows of the kit schedule. */
export const SCHEDULE_DAYS = 7;

/** The statuses that hold a room on a night. A cancelled stay and a no-show stay in the list view only. */
const ROOM_HOLDING: readonly ReservationStatus[] = [
	"pending",
	"confirmed",
	"checked_in",
	"checked_out",
];

/** One cell: the stays that the cell shows, and whether the room is closed on that night. */
export type ScheduleCell = {
	roomId: string;
	stays: ReservationRow[];
	/** True when the room is out of order on this night. */
	isClosed: boolean;
};

/** One row of the schedule: a night and one cell per room, in the order of the rooms. */
export type ScheduleRow = { day: string; cells: ScheduleCell[] };

/** The rows of the window that starts on `firstDay` (`YYYY-MM-DD`). */
export function buildSchedule(
	reservations: ReservationRow[],
	rooms: Room[],
	firstDay: string,
): ScheduleRow[] {
	const held = reservations.filter((row) => ROOM_HOLDING.includes(row.status));
	const firstMs = isoDayToMs(firstDay);
	return Array.from({ length: SCHEDULE_DAYS }, (_, index) => {
		const day = toIsoDay(addDays(firstMs, index));
		return {
			day,
			cells: rooms.map((room) => ({
				roomId: room.id,
				// `YYYY-MM-DD` texts compare in date order.
				stays: held.filter(
					(row) =>
						row.roomId === room.id &&
						(row.checkIn === day ||
							(index === 0 && row.checkIn < day && row.checkOut > day)),
				),
				isClosed:
					room.outOfOrder !== null &&
					toIsoDay(Date.parse(room.outOfOrder.since)) <= day &&
					day < room.outOfOrder.until,
			})),
		};
	});
}
