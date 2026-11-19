// Reads of hiring: the positions with their hiring manager, and the candidates with their position.
// The /app/hiring route prefetches both in its loader. The hiring page reads them with useSuspenseQuery.
// Each queryFn reads the sample tables of the people feature. A later turn replaces it with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type CandidateRow,
	fullName,
	type PositionRow,
	readPeopleTables,
} from "~/features/people";

/** One position with the name of the employee who decides the hire. */
export type Position = PositionRow & { hiringManagerName: string };

// Open positions first, then on hold, then filled; the oldest opening first inside a status.
const POSITION_ORDER = { open: 0, on_hold: 1, filled: 2 } as const;

/** Every position, open ones first. The position filter and the manager avatars of the hiring page read them. */
export function positionsQueryOptions() {
	return queryOptions({
		queryKey: ["hiring", "positions"],
		queryFn: async (): Promise<Position[]> => {
			const { positions, employees } = readPeopleTables();
			const names = new Map(
				employees.map((employee) => [employee.id, fullName(employee)]),
			);
			return positions
				.map((position) => ({
					...position,
					hiringManagerName: names.get(position.hiringManagerId) ?? "",
				}))
				.sort(
					(first, second) =>
						POSITION_ORDER[first.status] - POSITION_ORDER[second.status] ||
						first.openedAt.localeCompare(second.openedAt),
				);
		},
	});
}

/** One candidate with the facts of the position that the board card and the table show. */
export type Candidate = CandidateRow & {
	positionTitle: string;
	/** True while the position is open. The board shows only the candidates of open positions, and the hires. */
	isPositionOpen: boolean;
	/** The full name of the hiring manager of the position. "" when the manager row is missing. */
	hiringManagerName: string;
};

/** Every candidate, newest application first. The board, the table, and the dialog read them. */
export function candidatesQueryOptions() {
	return queryOptions({
		queryKey: ["hiring", "candidates"],
		queryFn: async (): Promise<Candidate[]> => {
			const { positions, candidates, employees } = readPeopleTables();
			const byId = new Map(
				positions.map((position) => [position.id, position]),
			);
			const names = new Map(
				employees.map((employee) => [employee.id, fullName(employee)]),
			);
			return candidates
				.map((candidate) => {
					const position = byId.get(candidate.positionId);
					return {
						...candidate,
						positionTitle: position?.title ?? "",
						isPositionOpen: position?.status === "open",
						hiringManagerName: position
							? (names.get(position.hiringManagerId) ?? "")
							: "",
					};
				})
				.sort((first, second) =>
					second.appliedAt.localeCompare(first.appliedAt),
				);
		},
	});
}
