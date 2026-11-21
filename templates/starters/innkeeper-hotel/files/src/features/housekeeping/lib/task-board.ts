// Shapes the housekeeping tasks of today for the page: the rows with their room, the 4 room columns,
// the priority, and the progress of each task. housekeeping.queries.ts builds the rows.
// HousekeepingPage, TaskCard, and the table view call the other functions on the filtered rows.
import {
	ATTENDANTS,
	type HousekeepingTask,
	MINUTE_MS,
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

/** The columns of the board, in the order of the work on a room. Its label is the message key `housekeeping.columns.<column>`. */
export const BOARD_COLUMNS = [
	"dirty",
	"cleaning",
	"inspection",
	"ready",
] as const;

/** One column of the board. */
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

/** The priority of a task. Its label is the message key `housekeeping.priorities.<priority>`. */
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;

/** One priority. `high` is a room that a guest needs today. */
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** The outline badge classes of each priority: high red, medium amber, low green (kit system, recipe 3.4). */
export const PRIORITY_BADGE = {
	high: "border-destructive/25 bg-destructive/12 text-destructive",
	medium: "border-warning/25 bg-warning/12 text-warning",
	low: "border-success/25 bg-success/12 text-success",
} satisfies Record<TaskPriority, string>;

// A supervisor checks each room in the 20 minutes after the clean ends. Then the desk can sell it.
const INSPECTION_MINUTES = 20;

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

/** The column of a task at `now` (milliseconds since 1970). A blocked task waits in "dirty". */
export function columnOf(row: TaskRow, now: number): BoardColumn {
	if (row.status === "todo" || row.status === "blocked") {
		return "dirty";
	}
	if (row.status === "in_progress") {
		return "cleaning";
	}
	return row.doneAt !== null &&
		now - Date.parse(row.doneAt) < INSPECTION_MINUTES * MINUTE_MS
		? "inspection"
		: "ready";
}

/** The priority of a task. An arrival today makes it high. A departure clean and a repair are medium. */
export function priorityOf(row: TaskRow): TaskPriority {
	const isOpen = row.status !== "done";
	if (row.dueAt !== null && isOpen) {
		return "high";
	}
	return row.kind === "departure" || row.kind === "maintenance"
		? "medium"
		: "low";
}

/** The share of the task that is done at `now`, from 0 to 1. A task in work grows with the clock. */
export function progressOf(row: TaskRow, now: number): number {
	if (row.status === "done") {
		return 1;
	}
	if (row.status !== "in_progress" || row.scheduledAt === null) {
		return 0;
	}
	const elapsed = (now - Date.parse(row.scheduledAt)) / MINUTE_MS;
	return Math.min(1, Math.max(0, elapsed / row.durationMinutes));
}

/**
 * The rows of one column. Dirty: the blocked tasks, then the next start first.
 * Cleaning: the oldest start first. Inspection and ready: the last finished first.
 */
export function tasksOfColumn(
	rows: TaskRow[],
	column: BoardColumn,
	now: number,
): TaskRow[] {
	const own = rows.filter((row) => columnOf(row, now) === column);
	if (column === "dirty" || column === "cleaning") {
		// A blocked task has no start time, so the empty text puts it first.
		return own.sort((first, second) =>
			(first.scheduledAt ?? "").localeCompare(second.scheduledAt ?? ""),
		);
	}
	return own.sort((first, second) =>
		(second.doneAt ?? "").localeCompare(first.doneAt ?? ""),
	);
}
