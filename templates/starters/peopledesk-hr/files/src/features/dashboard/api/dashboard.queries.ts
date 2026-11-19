// Read of the home figures for one period: the four KPIs, the hiring funnel, and the headcount per team.
// The /app route loader prefetches the default period. DashboardPage reads the other periods after a change.
// The queryFn reads the sample tables. A later turn replaces its body with SQL read functions that return the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	absenceDays,
	BOARD_STAGES,
	type BoardStage,
	changeRatio,
	DAY_MS,
	DEPARTMENTS,
	type Department,
	isWeekend,
	type PeriodDays,
	periodDayKeys,
	readPeopleTables,
	shiftDays,
	toDayKey,
} from "~/features/people";

/** The period of the first load of the home, in days. */
export const DASHBOARD_DEFAULT_DAYS = 30 satisfies PeriodDays;

/** One figure and its change against the period before. `change` is a ratio, null when no earlier value exists. */
type Figure = { value: number; change: number | null };

/** One row of the hiring funnel: a stage of the board and the people in it. */
export type FunnelRow = {
	stage: BoardStage;
	/** Candidates in the stage now. For "hired": the hires of the period. */
	count: number;
	/** The positions that these candidates applied for. */
	positions: number;
};

/** The figures of the home for one period. */
export type DashboardSummary = {
	/** People employed today, against the people employed on the first day of the period. */
	headcount: Figure & {
		/** People whose first day falls after the first day of the period, up to today. */
		joined: number;
		/** People whose last day falls in the period, today excluded. */
		left: number;
	};
	/** Open positions now, against the positions open on the first day of the period. */
	openRoles: Figure & {
		/** Candidates still in the race for the open positions. */
		candidates: number;
	};
	/** People on approved leave on the current working day, against the mean per working day of the period. */
	outToday: Figure & {
		/** True on a weekend: the figure then counts the next Monday. */
		isNextWorkday: boolean;
	};
	/** Mean calendar days from application to hire, for the hires of the period. null when nobody was hired. */
	timeToHire: { value: number | null; change: number | null; hires: number };
	/** The board stages, applied to hired, in order. */
	funnel: FunnelRow[];
	/** People employed today per department, in the order of DEPARTMENTS. */
	teams: { department: Department; count: number }[];
};

// The calendar days of the period: the last `days` days up to today. "previous" is the `days` days before.
function periodOf(day: string, days: number, today: number) {
	const daysAgo = Math.round(
		(today - new Date(`${day}T00:00:00`).getTime()) / DAY_MS,
	);
	if (daysAgo < 0) {
		return null;
	}
	return daysAgo < days ? "current" : daysAgo < 2 * days ? "previous" : null;
}

// Mean of a list, or null for an empty list.
function meanOf(values: number[]): number | null {
	return values.length === 0
		? null
		: values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The home figures of the last `days` days. The key holds the period, so each period has its own cache entry. */
export function dashboardQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["dashboard", days],
		queryFn: async (): Promise<DashboardSummary> => {
			const { employees, requests, positions, candidates, dayStart } =
				readPeopleTables();
			const today = toDayKey(new Date(dayStart));
			const periodStart = toDayKey(shiftDays(dayStart, 1 - days));

			const employedOn = (day: string) =>
				employees.filter(
					(employee) =>
						employee.startDate <= day &&
						(employee.endDate === null || employee.endDate >= day),
				);
			const employedNow = employedOn(today);

			const isOpenOn = (day: string) =>
				positions.filter(
					(position) =>
						position.openedAt <= day &&
						(position.closedAt === null || position.closedAt > day),
				).length;
			const openIds = new Set(
				positions
					.filter((position) => position.status === "open")
					.map((position) => position.id),
			);
			const inRace = candidates.filter(
				(candidate) =>
					openIds.has(candidate.positionId) && candidate.stage !== "rejected",
			);

			// Nobody works on a weekend. Then "out" counts the next working day, a Monday.
			let workdayOffset = 0;
			while (isWeekend(shiftDays(dayStart, workdayOffset))) {
				workdayOffset += 1;
			}
			const workday = toDayKey(shiftDays(dayStart, workdayOffset));
			const offDays = absenceDays(
				requests,
				new Map(
					employees.map((employee) => [employee.id, employee.department]),
				),
			);
			const outOnWorkday = offDays.filter((day) => day.day === workday).length;
			// The mean counts the working days of the period before today, so a weekend never lowers it.
			const pastWorkdays = periodDayKeys(days, dayStart).filter(
				(day) => !isWeekend(new Date(`${day}T00:00:00`)),
			);
			const pastWorkdaySet = new Set(pastWorkdays);
			const meanOut =
				pastWorkdays.length === 0
					? 0
					: offDays.filter((day) => pastWorkdaySet.has(day.day)).length /
						pastWorkdays.length;

			// One hire per filled position: the candidate who reached "hired", with the days since the application.
			const hires = candidates.flatMap((candidate) => {
				const hired = candidate.stageChanges.find(
					(change) => change.stage === "hired",
				);
				return hired
					? [
							{
								positionId: candidate.positionId,
								day: toDayKey(new Date(hired.at)),
								days: Math.round(
									(Date.parse(hired.at) - Date.parse(candidate.appliedAt)) /
										DAY_MS,
								),
							},
						]
					: [];
			});
			const hiresIn = (period: "current" | "previous") =>
				hires.filter((hire) => periodOf(hire.day, days, dayStart) === period);
			const currentHires = hiresIn("current");
			const meanDays = meanOf(currentHires.map((hire) => hire.days));
			const previousMeanDays = meanOf(
				hiresIn("previous").map((hire) => hire.days),
			);

			return {
				headcount: {
					value: employedNow.length,
					change: changeRatio(
						employedNow.length,
						employedOn(periodStart).length,
					),
					// A start on the first day is in the baseline already, so joined minus left equals the change.
					joined: employees.filter(
						(employee) =>
							employee.startDate > periodStart && employee.startDate <= today,
					).length,
					left: employees.filter(
						(employee) =>
							employee.endDate !== null &&
							employee.endDate >= periodStart &&
							employee.endDate < today,
					).length,
				},
				openRoles: {
					value: openIds.size,
					change: changeRatio(openIds.size, isOpenOn(periodStart)),
					candidates: inRace.length,
				},
				outToday: {
					value: outOnWorkday,
					change: meanOut === 0 ? null : changeRatio(outOnWorkday, meanOut),
					isNextWorkday: workdayOffset > 0,
				},
				timeToHire: {
					value: meanDays,
					change:
						meanDays === null || previousMeanDays === null
							? null
							: changeRatio(meanDays, previousMeanDays),
					hires: currentHires.length,
				},
				funnel: BOARD_STAGES.map((stage) => {
					const rows =
						stage === "hired"
							? currentHires
							: inRace.filter((candidate) => candidate.stage === stage);
					return {
						stage,
						count: rows.length,
						positions: new Set(rows.map((row) => row.positionId)).size,
					};
				}),
				teams: DEPARTMENTS.map((department) => ({
					department,
					count: employedNow.filter(
						(employee) => employee.department === department,
					).length,
				})),
			};
		},
	});
}
