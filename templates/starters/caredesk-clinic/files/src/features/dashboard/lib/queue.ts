// The rows of the queue card: a window of the appointments of today, from the first patient still to see.
// QueueCard calls it with the rows of the book and the current minute. The function is pure.
import {
	type AppointmentRow,
	addDays,
	rowsOfDay,
	startOfLocalDay,
} from "~/features/clinic";

/**
 * Up to `size` appointments of today that nobody cancelled, in start order.
 * The window starts at the first patient who is not seen yet. Late in the day it shows the last patients.
 */
export function queueWindow(
	rows: readonly AppointmentRow[],
	now: number,
	size: number,
): AppointmentRow[] {
	const todayStart = startOfLocalDay(now);
	const today = rowsOfDay(rows, todayStart, addDays(todayStart, 1)).filter(
		(row) => row.status !== "cancelled",
	);
	const firstOpen = today.findIndex(
		(row) => row.status !== "completed" && row.status !== "no_show",
	);
	// No patient left: the window keeps the end of the day, so the card shows how the day ended.
	const from = firstOpen === -1 ? today.length : firstOpen;
	const start = Math.max(0, Math.min(from, today.length - size));
	return today.slice(start, start + size);
}
