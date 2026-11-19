// Read of the header alerts: the time-off requests that wait for a decision, and the job offers that wait for an answer.
// HeaderNotifications reads it after the shell renders. The bell counts the same requests as the "Pending" filter
// of the time-off page, and the same offers as the "Offer" column of the hiring board.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import type { TimeOffType } from "../lib/codes";
import { fullName } from "../lib/leave";
import { readPeopleTables } from "../lib/sample-data";

// linkOptions types each path and search, so a wrong route fails typecheck.
function requestLink(requestId: string) {
	return linkOptions({ to: "/app/time-off", search: { request: requestId } });
}

function candidateLink(candidateId: string) {
	return linkOptions({ to: "/app/hiring", search: { candidate: candidateId } });
}

/** One alert of the bell menu. `kind` tells what waits and picks the second line. */
export type Alert =
	| {
			kind: "pendingRequest";
			/** The request number, for example "TO-4127". */
			id: string;
			/** The name of the employee who asks. */
			title: string;
			type: TimeOffType;
			/** The first and the last day off, YYYY-MM-DD. */
			startDate: string;
			endDate: string;
			/** ISO time of the request. The oldest request waits the longest. */
			at: string;
			link: ReturnType<typeof requestLink>;
	  }
	| {
			kind: "openOffer";
			/** The application number, for example "CA-5120". */
			id: string;
			/** The name of the candidate. */
			title: string;
			/** The title of the position of the offer. */
			detail: string;
			/** ISO time of the offer. */
			at: string;
			link: ReturnType<typeof candidateLink>;
	  };

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const { employees, requests, positions, candidates } = readPeopleTables();
			const names = new Map(
				employees.map((employee) => [employee.id, fullName(employee)]),
			);
			const openPositions = new Map(
				positions
					.filter((position) => position.status === "open")
					.map((position) => [position.id, position.title]),
			);
			const pending: Alert[] = requests
				.filter((request) => request.status === "pending")
				.map((request) => ({
					kind: "pendingRequest",
					id: request.id,
					title: names.get(request.employeeId) ?? request.employeeId,
					type: request.type,
					startDate: request.startDate,
					endDate: request.endDate,
					at: request.submittedAt,
					link: requestLink(request.id),
				}));
			const offers: Alert[] = candidates.flatMap((candidate) => {
				const positionTitle = openPositions.get(candidate.positionId);
				const offer = candidate.stageChanges.at(-1);
				return candidate.stage === "offer" && positionTitle && offer
					? [
							{
								kind: "openOffer" as const,
								id: candidate.id,
								title: candidate.name,
								detail: positionTitle,
								at: offer.at,
								link: candidateLink(candidate.id),
							},
						]
					: [];
			});
			return [...pending, ...offers].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
