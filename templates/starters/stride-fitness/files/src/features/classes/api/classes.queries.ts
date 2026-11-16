// Reads of the class sessions: the timetable of the week ahead and the fill of the last 30 days.
// The classes route and the home route prefetch them. The pages read them with useSuspenseQuery.
// The sample modules of ~/features/gym stand in for the tables. A later turn puts a Supabase read in each queryFn.
import { queryOptions } from "@tanstack/react-query";
import {
	activityOfDay,
	addDays,
	membersOfDay,
	startOfLocalDay,
	toSessionRows,
} from "~/features/gym";
import { buildClassFill } from "../lib/class-fill";

/** 30 days. Each class type runs 4 to 8 times a week, so the fill of each type has 16 or more sessions. */
export const FILL_DAYS = 30;

/** Every session from today to 6 days ahead, with its roster, the earliest first. The home filters today. */
export function classSessionsQueryOptions() {
	return queryOptions({
		queryKey: ["class-sessions", "week"],
		queryFn: async () => {
			const todayStart = startOfLocalDay(Date.now());
			const activity = activityOfDay(todayStart);
			const sessions = activity.sessions.filter(
				(session) => session.startsAt >= todayStart,
			);
			return toSessionRows(
				sessions,
				activity.checkIns,
				membersOfDay(todayStart),
			);
		},
	});
}

/** The fill of each class type over the last FILL_DAYS days, the fullest first. Only ended sessions count. */
export function classFillQueryOptions() {
	return queryOptions({
		queryKey: ["class-sessions", "fill", FILL_DAYS],
		queryFn: async () => {
			const now = Date.now();
			const todayStart = startOfLocalDay(now);
			const from = addDays(todayStart, -FILL_DAYS);
			const activity = activityOfDay(todayStart);
			const sessions = activity.sessions.filter(
				(session) =>
					session.startsAt >= from &&
					session.endsAt <= now &&
					!session.isCancelled,
			);
			return buildClassFill(
				toSessionRows(sessions, activity.checkIns, membersOfDay(todayStart)),
			);
		},
	});
}
