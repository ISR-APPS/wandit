// Reads of hiring: the positions with their pipeline counts, the candidates, the daily applications, and the figures.
// The hiring and overview routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample tables of the people feature. A later turn replaces it with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type BOARD_STAGES,
	buildDailySeries,
	type CandidateRow,
	changeRatio,
	fullName,
	type KpiItem,
	type PositionRow,
	readPeopleTables,
	type Stage,
	shiftDays,
	toDayKey,
} from "~/features/people";
import type { TranslationKey } from "~/shared/i18n";

/** A stage of the board: every stage except "rejected". */
export type BoardStage = (typeof BOARD_STAGES)[number];

/** One position with the counts that the position cards show. */
export type Position = PositionRow & {
	hiringManagerName: string;
	/** Every application since the position opened, rejected ones included. */
	applicationCount: number;
	/** Candidates on the board per stage. Rejected candidates are not on the board. */
	stageCounts: Record<BoardStage, number>;
};

// Open positions first, then on hold, then filled; the oldest opening first inside a status.
const POSITION_ORDER = { open: 0, on_hold: 1, filled: 2 } as const;

/** Every position, open ones first. The hiring page lists them as cards. */
export function positionsQueryOptions() {
	return queryOptions({
		queryKey: ["hiring", "positions"],
		queryFn: async (): Promise<Position[]> => {
			const { positions, candidates, employees } = readPeopleTables();
			return positions
				.map((position) => {
					const manager = employees.find(
						(row) => row.id === position.hiringManagerId,
					);
					const applications = candidates.filter(
						(candidate) => candidate.positionId === position.id,
					);
					const stageCounts: Record<BoardStage, number> = {
						applied: 0,
						screening: 0,
						interview: 0,
						offer: 0,
						hired: 0,
					};
					for (const candidate of applications) {
						if (candidate.stage !== "rejected") {
							stageCounts[candidate.stage] += 1;
						}
					}
					return {
						...position,
						hiringManagerName: manager ? fullName(manager) : "",
						applicationCount: applications.length,
						stageCounts,
					};
				})
				.sort(
					(first, second) =>
						POSITION_ORDER[first.status] - POSITION_ORDER[second.status] ||
						first.openedAt.localeCompare(second.openedAt),
				);
		},
	});
}

/** One candidate with the title of the position. */
export type Candidate = CandidateRow & { positionTitle: string };

/** Every candidate, newest application first. The board, the dialog, and the overview read them. */
export function candidatesQueryOptions() {
	return queryOptions({
		queryKey: ["hiring", "candidates"],
		queryFn: async (): Promise<Candidate[]> => {
			const { positions, candidates } = readPeopleTables();
			const titles = new Map(
				positions.map((position) => [position.id, position.title]),
			);
			return candidates
				.map((candidate) => ({
					...candidate,
					positionTitle: titles.get(candidate.positionId) ?? "",
				}))
				.reverse();
		},
	});
}

/** Applications per day for the last `days` full days and the period before. Feeds the hiring trend. */
export function dailyApplicationsQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["hiring", "daily", days],
		queryFn: async () => {
			const { candidates, dayStart } = readPeopleTables();
			return buildDailySeries(
				candidates.map((candidate) => ({
					day: toDayKey(new Date(candidate.appliedAt)),
					value: 1,
				})),
				days,
				dayStart,
			);
		},
	});
}

/** One figure before translation. The page turns `labelKey` into the `label` of KpiItem with t(). */
export type HiringKpi = Omit<KpiItem, "label" | "note"> & {
	labelKey: TranslationKey;
	/** The key of the scope line of a figure with no delta. The page turns it into `note`. */
	noteKey?: TranslationKey;
};

// The stages of a candidate who is still in the race.
const ACTIVE_STAGES: Stage[] = ["applied", "screening", "interview", "offer"];
// The application figure compares 30 days with the 30 days before.
const APPLICATION_PERIOD_DAYS = 30;
// The interview figure looks one week ahead.
const INTERVIEW_AHEAD_DAYS = 7;

/** The four figures of the hiring page: open positions, candidates in process, interviews ahead, applications. */
export function hiringKpisQueryOptions() {
	return queryOptions({
		queryKey: ["hiring", "kpis"],
		queryFn: async (): Promise<HiringKpi[]> => {
			const { positions, candidates, dayStart } = readPeopleTables();
			const openIds = new Set(
				positions
					.filter((position) => position.status === "open")
					.map((position) => position.id),
			);
			const aheadEnd = shiftDays(dayStart, INTERVIEW_AHEAD_DAYS).toISOString();
			const applications = buildDailySeries(
				candidates.map((candidate) => ({
					day: toDayKey(new Date(candidate.appliedAt)),
					value: 1,
				})),
				APPLICATION_PERIOD_DAYS,
				dayStart,
			);
			const applied = applications.reduce(
				(sum, point) => sum + point.current,
				0,
			);
			const appliedBefore = applications.reduce(
				(sum, point) => sum + point.previous,
				0,
			);
			return [
				// The database keeps no history of these counts, so they show no delta.
				{
					id: "open-positions",
					labelKey: "hiring.kpiOpen",
					noteKey: "hiring.kpiOpenNote",
					value: openIds.size,
					change: null,
					goodWhen: "up",
				},
				{
					id: "in-process",
					labelKey: "hiring.kpiInProcess",
					noteKey: "hiring.kpiInProcessNote",
					value: candidates.filter(
						(candidate) =>
							openIds.has(candidate.positionId) &&
							ACTIVE_STAGES.includes(candidate.stage),
					).length,
					change: null,
					goodWhen: "up",
				},
				{
					id: "interviews",
					labelKey: "hiring.kpiInterviews",
					noteKey: "hiring.kpiInterviewsNote",
					value: candidates.filter(
						(candidate) =>
							candidate.interviewAt !== null &&
							candidate.interviewAt < aheadEnd,
					).length,
					change: null,
					goodWhen: "up",
				},
				{
					id: "applications",
					labelKey: "hiring.kpiApplications",
					value: applied,
					change: changeRatio(applied, appliedBefore),
					goodWhen: "up",
				},
			];
		},
	});
}
