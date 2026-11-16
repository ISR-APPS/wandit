// Reads of the members: the list with the visits of each member, and the page data of one member.
// The members routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// The sample modules of ~/features/gym stand in for the tables. A later turn puts a Supabase read in each queryFn.
import { queryOptions } from "@tanstack/react-query";
import {
	activityOfDay,
	checkInsUntil,
	membersOfDay,
	startOfLocalDay,
	toSessionRows,
} from "~/features/gym";
import { buildMemberDetail, buildMemberRows } from "../lib/member-rows";

/** Every member, newest first, with the last visit and the visits of 30 days. The list page pages them. */
export function membersQueryOptions() {
	return queryOptions({
		queryKey: ["members", "list"],
		queryFn: async () => {
			const now = Date.now();
			const todayStart = startOfLocalDay(now);
			return buildMemberRows(
				membersOfDay(todayStart),
				checkInsUntil(activityOfDay(todayStart), now),
				todayStart,
			);
		},
	});
}

/** One member with the visits, the attendance, and the classes ahead. null for an unknown id. */
export function memberQueryOptions(memberId: string) {
	return queryOptions({
		queryKey: ["members", "detail", memberId],
		queryFn: async () => {
			const now = Date.now();
			const todayStart = startOfLocalDay(now);
			const members = membersOfDay(todayStart);
			// The id comes from the URL. An unknown id is "not found", not an error.
			const member = members.find((row) => row.id === memberId);
			if (!member) {
				return null;
			}
			const activity = activityOfDay(todayStart);
			const sessionsAhead = activity.sessions.filter(
				(session) => session.startsAt >= todayStart,
			);
			return buildMemberDetail(
				member,
				checkInsUntil(activity, now).filter(
					(checkIn) => checkIn.memberId === memberId,
				),
				activity.sessions,
				toSessionRows(sessionsAhead, activity.checkIns, members),
				todayStart,
				now,
			);
		},
	});
}
