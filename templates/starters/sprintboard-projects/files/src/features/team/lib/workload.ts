// The workload of each team member: committed story points by status, open and late tasks, and recent output.
// TeamPage builds the rows with buildWorkload during render. The table, its filters, and the side sheet read the same rows.
import {
	isOverdue,
	type Member,
	periodOf,
	type Task,
} from "~/features/tracker";

/** The Team page counts the output of the last 30 days. */
export const OUTPUT_DAYS = 30;

/** One row of the Team page. Points are story points of committed tasks (To do, In progress, In review). */
export type WorkloadRow = {
	id: string;
	member: Member;
	todoPoints: number;
	progressPoints: number;
	reviewPoints: number;
	/** todoPoints + progressPoints + reviewPoints. */
	committedPoints: number;
	/** committedPoints / capacity. Above 1 the person is over capacity. */
	load: number;
	/** Every open task of the person, backlog included, in work order (in review first). */
	openTasks: Task[];
	overdueCount: number;
	/** Tasks done in the last OUTPUT_DAYS full days, with the window rule of the overview (periodOf). */
	doneCount: number;
};

// The sheet lists the work closest to done first.
const WORK_ORDER = ["in-review", "in-progress", "todo", "backlog"];

/** One row per member, the highest load first. */
export function buildWorkload(
	members: Member[],
	tasks: Task[],
	now: number,
): WorkloadRow[] {
	return members
		.map((member) => {
			const own = tasks.filter((task) => task.assigneeId === member.id);
			const open = own.filter((task) => task.status !== "done");
			const points = (status: Task["status"]) =>
				open
					.filter((task) => task.status === status)
					.reduce((sum, task) => sum + task.estimate, 0);
			const todoPoints = points("todo");
			const progressPoints = points("in-progress");
			const reviewPoints = points("in-review");
			const committedPoints = todoPoints + progressPoints + reviewPoints;
			return {
				id: member.id,
				member,
				todoPoints,
				progressPoints,
				reviewPoints,
				committedPoints,
				load: member.capacity === 0 ? 0 : committedPoints / member.capacity,
				openTasks: [...open].sort(
					(first, second) =>
						WORK_ORDER.indexOf(first.status) -
						WORK_ORDER.indexOf(second.status),
				),
				overdueCount: open.filter((task) => isOverdue(task, now)).length,
				doneCount: own.filter(
					(task) =>
						task.completedAt !== null &&
						periodOf(task.completedAt, OUTPUT_DAYS, now) === "current",
				).length,
			};
		})
		.sort((first, second) => second.load - first.load);
}

/** The load states of a person, from free to over capacity. The Team table filters and sorts by them. */
export const LOAD_STATES = ["available", "busy", "over"] as const;

/** One load state. */
export type LoadState = (typeof LOAD_STATES)[number];

// From 85 % of the capacity a person is busy, as the amber step of CapacityMeter.
const BUSY_LOAD = 0.85;

/** Under 85 % is available, 85 % to 100 % is busy, above 100 % is over capacity. */
export function loadStateOf(load: number): LoadState {
	if (load > 1) {
		return "over";
	}
	return load >= BUSY_LOAD ? "busy" : "available";
}
