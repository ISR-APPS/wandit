// The pure functions behind the home: the KPI figures, the team highlights, the monthly totals,
// the on-time split, the work series, and the next due tasks. The overview queries call them with the sample rows.
// Every "last N days" figure uses periodOf of the tracker, so the home agrees with the other pages.
import {
	cycleTimeDays,
	DAY_MS,
	isDueBetween,
	isOverdue,
	type Member,
	type PeriodDays,
	type ProjectRow,
	periodOf,
	startOfLocalDay,
	type Task,
	type TaskRow,
} from "~/features/tracker";

/** One KPI value and its change against the period before, as a ratio. null change: no earlier data. */
export type Figure = { value: number; change: number | null };

/** One figure that can be missing, for example a median of no task. */
export type OptionalFigure = { value: number | null; change: number | null };

/** One person of the "Top contributors" row: the most story points done in the period. */
export type Contributor = { id: string; name: string; points: number };

/** The tasks done in one calendar month. */
export type MonthTotal = {
	/** The first day of the month, local midnight, in milliseconds since 1970. */
	monthStart: number;
	count: number;
};

/** The delivery classes of a done task with a due day, in the order of the donut. */
export const DELIVERY_CLASSES = [
	"early",
	"onTime",
	"late",
	"veryLate",
] as const;

/** One delivery class. */
export type DeliveryClass = (typeof DELIVERY_CLASSES)[number];

/** Everything the home shows for one period. */
export type OverviewSummary = {
	/** Projects that run now (started, not paused or completed). The change compares with the start of the period. */
	activeProjects: Figure;
	/** Planned open tasks due in the next 7 days (isDueBetween). The change compares with the same count for the last 7 days. */
	dueThisWeek: Figure;
	/** Hours logged on the tasks done in the period. */
	hoursLogged: Figure;
	/** Overdue tasks now. The change compares with the overdue tasks at the start of the period. */
	overdue: Figure;
	headcount: number;
	/** At most 6 people, the most points first. */
	contributors: Contributor[];
	/** Median start-to-done time of the tasks done in the period, in days. */
	cycleTime: OptionalFigure;
	/** Story points done in the period per team member. */
	pointsPerPerson: Figure;
	/** Bugs moved to done in the period. */
	bugsFixed: Figure;
	/** The last 3 full calendar months, the newest first. */
	months: MonthTotal[];
	/** Done tasks of the period with a due day, per delivery class. */
	delivery: Record<DeliveryClass, number>;
};

/** One working day of the work chart. */
export type WorkPoint = {
	/** YYYY-MM-DD in the browser time zone. */
	day: string;
	/** Features done that day. */
	features: number;
	/** Bugs and chores done that day. */
	fixes: number;
};

// Change as a ratio. A previous value of 0 gives no ratio: the card shows "No earlier data", never "0%".
function ratio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

function median(values: number[]): number | null {
	if (values.length === 0) {
		return null;
	}
	const sorted = [...values].sort((first, second) => first - second);
	const middle = Math.floor(sorted.length / 2);
	const upper = sorted[middle] ?? 0;
	return sorted.length % 2 === 1
		? upper
		: ((sorted[middle - 1] ?? upper) + upper) / 2;
}

// A project runs at `at` when it started before and did not end (pause or completion) before.
function isRunningAt(project: ProjectRow, at: number): boolean {
	return (
		Date.parse(project.startAt) <= at &&
		(project.endedAt === null || Date.parse(project.endedAt) > at)
	);
}

// The overdue rule of the tracker, replayed at a past time: due before `at`, written before it, and not done by then.
// Backlog work is never late, as in isOverdue.
function wasOverdueAt(task: TaskRow, at: number): boolean {
	return (
		task.status !== "backlog" &&
		task.dueAt !== null &&
		Date.parse(task.dueAt) < at &&
		Date.parse(task.createdAt) <= at &&
		(task.completedAt === null || Date.parse(task.completedAt) > at)
	);
}

// The calendar days from the due day to the done day. Math.round absorbs a clock change.
function daysLate(task: TaskRow): number | null {
	if (task.dueAt === null || task.completedAt === null) {
		return null;
	}
	return Math.round(
		(startOfLocalDay(Date.parse(task.completedAt)) -
			startOfLocalDay(Date.parse(task.dueAt))) /
			DAY_MS,
	);
}

/** Before the due day is early, the due day is on time, 1 or 2 days after is late, 3 days or more is very late. */
export function deliveryClassOf(lateDays: number): DeliveryClass {
	if (lateDays < 0) {
		return "early";
	}
	if (lateDays === 0) {
		return "onTime";
	}
	return lateDays <= 2 ? "late" : "veryLate";
}

/** The figures of the last `days` full days, against the `days` days before. */
export function buildSummary(
	tasks: TaskRow[],
	projects: ProjectRow[],
	members: Member[],
	days: PeriodDays,
	now: number,
): OverviewSummary {
	const periodStart = startOfLocalDay(now) - days * DAY_MS;
	const doneIn = (window: "current" | "previous") =>
		tasks.filter(
			(task) =>
				task.completedAt !== null &&
				periodOf(task.completedAt, days, now) === window,
		);
	const doneNow = doneIn("current");
	const doneBefore = doneIn("previous");
	const sum = (rows: TaskRow[], value: (row: TaskRow) => number) =>
		rows.reduce((total, row) => total + value(row), 0);

	const weekEnd = now + 7 * DAY_MS;
	const weekStart = now - 7 * DAY_MS;
	// Both sides use one rule, so the change compares the same kind of task.
	const dueNext = tasks.filter((task) =>
		isDueBetween(task, now, weekEnd),
	).length;
	const dueLast = tasks.filter((task) =>
		isDueBetween(task, weekStart, now),
	).length;

	const activeNow = projects.filter((project) =>
		isRunningAt(project, now),
	).length;
	const activeBefore = projects.filter((project) =>
		isRunningAt(project, periodStart),
	).length;
	const overdueNow = tasks.filter((task) => isOverdue(task, now)).length;
	const overdueBefore = tasks.filter((task) =>
		wasOverdueAt(task, periodStart),
	).length;

	// Minutes to hours: the KPI shows whole hours.
	const hoursNow = sum(doneNow, (task) => task.loggedMinutes) / 60;
	const hoursBefore = sum(doneBefore, (task) => task.loggedMinutes) / 60;

	const cycleNow = median(doneNow.flatMap((task) => cycleTimeDays(task) ?? []));
	const cycleBefore = median(
		doneBefore.flatMap((task) => cycleTimeDays(task) ?? []),
	);
	const headcount = members.length;
	const perPerson = (rows: TaskRow[]) =>
		headcount === 0 ? 0 : sum(rows, (task) => task.estimate) / headcount;
	const bugs = (rows: TaskRow[]) =>
		rows.filter((task) => task.kind === "bug").length;

	const pointsByMember = new Map<string, number>();
	for (const task of doneNow) {
		if (task.assigneeId !== null) {
			pointsByMember.set(
				task.assigneeId,
				(pointsByMember.get(task.assigneeId) ?? 0) + task.estimate,
			);
		}
	}
	const contributors = members
		.map((member) => ({
			id: member.id,
			name: member.name,
			points: pointsByMember.get(member.id) ?? 0,
		}))
		.filter((contributor) => contributor.points > 0)
		.sort((first, second) => second.points - first.points)
		.slice(0, 6);

	const delivery: Record<DeliveryClass, number> = {
		early: 0,
		onTime: 0,
		late: 0,
		veryLate: 0,
	};
	for (const task of doneNow) {
		const late = daysLate(task);
		if (late !== null) {
			delivery[deliveryClassOf(late)] += 1;
		}
	}

	return {
		activeProjects: {
			value: activeNow,
			change: ratio(activeNow, activeBefore),
		},
		dueThisWeek: { value: dueNext, change: ratio(dueNext, dueLast) },
		hoursLogged: { value: hoursNow, change: ratio(hoursNow, hoursBefore) },
		overdue: { value: overdueNow, change: ratio(overdueNow, overdueBefore) },
		headcount,
		contributors,
		cycleTime: {
			value: cycleNow,
			change:
				cycleNow === null || cycleBefore === null
					? null
					: ratio(cycleNow, cycleBefore),
		},
		pointsPerPerson: {
			value: perPerson(doneNow),
			change: ratio(perPerson(doneNow), perPerson(doneBefore)),
		},
		bugsFixed: {
			value: bugs(doneNow),
			change: ratio(bugs(doneNow), bugs(doneBefore)),
		},
		months: lastFullMonths(tasks, now, 3),
		delivery,
	};
}

/** The done tasks of the last `count` full calendar months, the newest month first. The current month is not over, so it is left out. */
export function lastFullMonths(
	tasks: TaskRow[],
	now: number,
	count: number,
): MonthTotal[] {
	const today = new Date(now);
	return Array.from({ length: count }, (_, index) => {
		const start = new Date(
			today.getFullYear(),
			today.getMonth() - index - 1,
			1,
		).getTime();
		const end = new Date(
			today.getFullYear(),
			today.getMonth() - index,
			1,
		).getTime();
		return {
			monthStart: start,
			count: tasks.filter((task) => {
				const doneAt =
					task.completedAt === null ? null : Date.parse(task.completedAt);
				return doneAt !== null && doneAt >= start && doneAt < end;
			}).length,
		};
	});
}

/** The next open tasks with a due time from now on, the earliest first. Overdue tasks are in the bell instead. */
export function upcomingTasks(tasks: Task[], now: number): Task[] {
	return tasks
		.filter(
			(task) =>
				task.status !== "done" &&
				task.status !== "backlog" &&
				task.dueAt !== null &&
				Date.parse(task.dueAt) >= now,
		)
		.sort((first, second) =>
			(first.dueAt ?? "").localeCompare(second.dueAt ?? ""),
		);
}
