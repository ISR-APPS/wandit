// Shapes the housekeeping tasks of today for the page: the rows with their room, the 3 columns, and the workload.
// housekeeping.queries.ts builds the rows. HousekeepingPage calls the two other functions on the filtered rows.
import {
	ATTENDANTS,
	type Attendant,
	type HousekeepingTask,
	type Room,
	type RoomType,
} from "~/features/hotel";

/** One task with the facts of its room and the name of its attendant. */
export type TaskRow = HousekeepingTask & {
	/** The number on the door. */
	roomNumber: string;
	roomType: RoomType;
	floor: 1 | 2 | 3;
	attendantName: string;
};

/** The columns of the board, in the order of the work. A blocked task sits in the first column. */
export const BOARD_COLUMNS = ["todo", "in_progress", "done"] as const;

/** One column of the board. Its label is the message key `housekeeping.statuses.<column>`. */
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

/** The tasks with their room and their attendant. A task of an unknown room gets no row. */
export function buildTaskRows(
	tasks: HousekeepingTask[],
	rooms: Room[],
): TaskRow[] {
	return tasks.flatMap((task) => {
		const room = rooms.find((candidate) => candidate.id === task.roomId);
		return room
			? [
					{
						...task,
						roomNumber: room.number,
						roomType: room.type,
						floor: room.floor,
						attendantName:
							ATTENDANTS.find((attendant) => attendant.id === task.attendantId)
								?.fullName ?? "",
					},
				]
			: [];
	});
}

/**
 * The rows of one column. To do: the blocked tasks, then the next start first.
 * In progress: the oldest start first. Done: the last finished first.
 */
export function tasksOfColumn(rows: TaskRow[], column: BoardColumn): TaskRow[] {
	const byStart = (first: TaskRow, second: TaskRow) =>
		(first.scheduledAt ?? "").localeCompare(second.scheduledAt ?? "");
	if (column === "todo") {
		// A blocked task has no start time, so the empty text puts it first.
		return rows
			.filter((row) => row.status === "todo" || row.status === "blocked")
			.sort(byStart);
	}
	if (column === "in_progress") {
		return rows.filter((row) => row.status === "in_progress").sort(byStart);
	}
	return rows
		.filter((row) => row.status === "done")
		.sort((first, second) =>
			(second.doneAt ?? "").localeCompare(first.doneAt ?? ""),
		);
}

/** The done tasks and all tasks of one attendant today. */
export type Workload = {
	attendant: Attendant;
	done: number;
	total: number;
};

/** One entry per attendant, in the order of the team. A blocked task counts in the total: the room still needs the work. */
export function workloadPerAttendant(rows: TaskRow[]): Workload[] {
	return ATTENDANTS.map((attendant) => {
		const own = rows.filter((row) => row.attendantId === attendant.id);
		return {
			attendant,
			done: own.filter((row) => row.status === "done").length,
			total: own.length,
		};
	});
}
