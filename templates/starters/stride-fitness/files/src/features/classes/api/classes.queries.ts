// Reads of the class sessions: the sessions from today on, and the sessions of one calendar week.
// The home route and the classes route prefetch them. The pages read them with useSuspenseQuery.
// The sample modules of ~/features/gym stand in for the tables. A later turn puts a Supabase read in each queryFn.
import { queryOptions } from "@tanstack/react-query";
import {
	activityOfDay,
	addDays,
	membersOfDay,
	startOfLocalDay,
	toSessionRows,
} from "~/features/gym";
import { dayKeyToStart, WEEK_LENGTH } from "../lib/week";

/** Every session from today to 6 days ahead, with its roster, the earliest first. The home filters today. */
export function classSessionsQueryOptions() {
	return queryOptions({
		queryKey: ["class-sessions", "ahead"],
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

/** The sessions of the week that starts on `weekKey` (a Monday, `YYYY-MM-DD`), with their rosters, the earliest first. */
export function classWeekQueryOptions(weekKey: string) {
	return queryOptions({
		queryKey: ["class-sessions", "week", weekKey],
		queryFn: async () => {
			const todayStart = startOfLocalDay(Date.now());
			const weekStart = dayKeyToStart(weekKey);
			const weekEnd = addDays(weekStart, WEEK_LENGTH);
			const activity = activityOfDay(todayStart);
			return toSessionRows(
				activity.sessions.filter(
					(session) =>
						session.startsAt >= weekStart && session.startsAt < weekEnd,
				),
				activity.checkIns,
				membersOfDay(todayStart),
			);
		},
	});
}
