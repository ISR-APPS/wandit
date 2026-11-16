// The figures, the daily series, and the breakdown of the overview, built from task rows for one period.
// overview.queries.ts calls buildOverview in its queryFn. A SQL read function does the same math later.
// Every figure uses periodOf, so a figure and the breakdown total of one period agree.
import {
	type BreakdownSlice,
	buildDailySeries,
	changeRatio,
	cycleTimeDays,
	type DailyPoint,
	type ProjectRow,
	periodOf,
	periodTotals,
	type TaskRow,
} from "~/features/tracker";

/** The ids of the overview figures. The page reads the label `kpi.<id>` from messages.ts. */
export type KpiId =
	| "completed"
	| "bugsReported"
	| "pointsShipped"
	| "cycleTime"
	| "bugsFixed"
	| "onTime";

/** One figure of the overview. */
export type KpiItem = {
	id: KpiId;
	/** The value of the current period. */
	value: number;
	/** The change against the previous period, as a ratio. null when the previous value is 0. */
	change: number | null;
	/** "down" when a fall is good news. */
	goodWhen: "up" | "down";
	/** The Intl options of the value, for example a unit of days. */
	format: Intl.NumberFormatOptions;
};

/** All the numbers of the overview for one period. */
export type OverviewData = {
	/** Tasks done per working day. */
	completedDaily: DailyPoint[];
	/** Bugs written per working day. */
	bugsDaily: DailyPoint[];
	/** Tasks done in the period per project: the 5 largest and "other". */
	completedByProject: BreakdownSlice[];
	/** completed, bugsReported, pointsShipped, cycleTime, bugsFixed, onTime, in this order. */
	kpis: KpiItem[];
};

/** The task fields that the overview reads. */
type OverviewTask = Pick<
	TaskRow,
	| "projectId"
	| "kind"
	| "estimate"
	| "createdAt"
	| "startedAt"
	| "completedAt"
	| "dueAt"
>;

// The breakdown shows the 5 largest projects. The rest joins "other".
const BREAKDOWN_PARTS = 5;

// The middle value of a list. The middle of an even list is the mean of its two middle values.
function median(values: number[]): number {
	const sorted = [...values].sort((first, second) => first - second);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length === 0) {
		return 0;
	}
	return sorted.length % 2 === 0
		? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
		: (sorted[middle] ?? 0);
}

/** Builds the overview of the last `days` full days, up to yesterday, against the `days` days before. */
export function buildOverview(
	tasks: OverviewTask[],
	projects: ProjectRow[],
	days: number,
	now: number,
): OverviewData {
	const done = tasks.flatMap((task) =>
		task.completedAt === null
			? []
			: [
					{
						task,
						completedAt: task.completedAt,
						period: periodOf(task.completedAt, days, now),
					},
				],
	);
	const doneNow = done.filter((entry) => entry.period === "current");
	const doneBefore = done.filter((entry) => entry.period === "previous");

	const completedTimes = done.map((entry) => entry.completedAt);
	const bugTimes = tasks
		.filter((task) => task.kind === "bug")
		.map((task) => task.createdAt);
	const completedDaily = buildDailySeries(completedTimes, days, now);
	const bugsDaily = buildDailySeries(bugTimes, days, now);

	const countByProject = new Map<string, number>();
	for (const { task } of doneNow) {
		countByProject.set(
			task.projectId,
			(countByProject.get(task.projectId) ?? 0) + 1,
		);
	}
	const ranked = projects
		.map((project) => ({
			id: project.id,
			label: project.name,
			value: countByProject.get(project.id) ?? 0,
		}))
		.filter((slice) => slice.value > 0)
		.sort((first, second) => second.value - first.value);
	const otherValue = ranked
		.slice(BREAKDOWN_PARTS)
		.reduce((sum, slice) => sum + slice.value, 0);
	const completedByProject = [
		...ranked.slice(0, BREAKDOWN_PARTS),
		...(otherValue > 0
			? [{ id: "other", label: "other", value: otherValue }]
			: []),
	];

	const points = (entries: typeof done) =>
		entries.reduce((sum, entry) => sum + entry.task.estimate, 0);
	const bugsFixed = (entries: typeof done) =>
		entries.filter((entry) => entry.task.kind === "bug").length;
	const cycleTimes = (entries: typeof done) =>
		entries.flatMap((entry) => {
			const value = cycleTimeDays(entry.task);
			return value === null ? [] : [value];
		});
	// The share of the done tasks with a due day that were done by it. 0 when no done task had a due day.
	const onTimeShare = (entries: typeof done) => {
		const dated = entries.flatMap((entry) =>
			entry.task.dueAt === null
				? []
				: [Date.parse(entry.completedAt) <= Date.parse(entry.task.dueAt)],
		);
		return dated.length === 0
			? 0
			: dated.filter((isOnTime) => isOnTime).length / dated.length;
	};
	const completedTotals = periodTotals(completedTimes, days, now);
	const bugTotals = periodTotals(bugTimes, days, now);
	const cycleNow = median(cycleTimes(doneNow));
	const cycleBefore = median(cycleTimes(doneBefore));

	return {
		completedDaily,
		bugsDaily,
		completedByProject,
		kpis: [
			{
				id: "completed",
				value: completedTotals.current,
				change: completedTotals.change,
				goodWhen: "up",
				format: {},
			},
			{
				id: "bugsReported",
				value: bugTotals.current,
				change: bugTotals.change,
				goodWhen: "down",
				format: {},
			},
			{
				id: "pointsShipped",
				value: points(doneNow),
				change: changeRatio(points(doneNow), points(doneBefore)),
				goodWhen: "up",
				format: {},
			},
			{
				id: "cycleTime",
				value: cycleNow,
				change: changeRatio(cycleNow, cycleBefore),
				goodWhen: "down",
				format: {
					style: "unit",
					unit: "day",
					unitDisplay: "long",
					maximumFractionDigits: 1,
				},
			},
			{
				id: "bugsFixed",
				value: bugsFixed(doneNow),
				change: changeRatio(bugsFixed(doneNow), bugsFixed(doneBefore)),
				goodWhen: "up",
				format: {},
			},
			{
				id: "onTime",
				value: onTimeShare(doneNow),
				change: changeRatio(onTimeShare(doneNow), onTimeShare(doneBefore)),
				goodWhen: "up",
				format: { style: "percent", maximumFractionDigits: 0 },
			},
		],
	};
}
