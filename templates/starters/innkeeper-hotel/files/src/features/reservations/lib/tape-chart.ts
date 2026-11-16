// The math of the calendar view (a tape chart): which bar sits on which days of a room row.
// TapeChart calls it. A row is a CSS grid of half days, so a stay starts and ends at noon.
import { daysBetween, type Room, toIsoDay } from "~/features/hotel";
import type { ReservationRow } from "../api/reservations.queries";

/** The calendar shows 14 days at a time. */
export const TAPE_DAYS = 14;
/** The last grid line of a row: two half days per day, plus the first line. */
const LAST_LINE = TAPE_DAYS * 2 + 1;

/** One bar of a room row. The lines are CSS grid lines from 1 to 29. */
export type TapeBar = {
	/** A reservation id, or "closed" for the out-of-order bar. Also the React key. */
	id: string;
	/** The stay of the bar. null for the out-of-order bar. */
	reservation: ReservationRow | null;
	startLine: number;
	endLine: number;
};

/**
 * The bars of one room for the 14 days from `windowStart` (`YYYY-MM-DD`).
 * A stay starts at the middle of its arrival day and ends at the middle of its departure day.
 * A cancelled stay and a no-show keep no room, so they get no bar.
 */
export function tapeBarsOfRoom(
	room: Room,
	rows: ReservationRow[],
	windowStart: string,
): TapeBar[] {
	const bars: TapeBar[] = rows
		.filter(
			(row) =>
				row.roomId === room.id &&
				row.status !== "cancelled" &&
				row.status !== "no_show",
		)
		.map((row) => ({
			id: row.id,
			reservation: row,
			// Day n starts at line 2n + 1. Its middle is line 2n + 2.
			startLine: daysBetween(windowStart, row.checkIn) * 2 + 2,
			endLine: daysBetween(windowStart, row.checkOut) * 2 + 2,
		}));
	if (room.outOfOrder) {
		bars.push({
			id: "closed",
			reservation: null,
			// A closed room starts and ends at the middle of a day, as a stay does. So it never lies over the stay before it.
			startLine:
				daysBetween(windowStart, toIsoDay(Date.parse(room.outOfOrder.since))) *
					2 +
				2,
			endLine: daysBetween(windowStart, room.outOfOrder.until) * 2 + 2,
		});
	}
	return bars
		.filter((bar) => bar.endLine > 1 && bar.startLine < LAST_LINE)
		.map((bar) => ({
			...bar,
			startLine: Math.max(1, bar.startLine),
			endLine: Math.min(LAST_LINE, bar.endLine),
		}));
}
