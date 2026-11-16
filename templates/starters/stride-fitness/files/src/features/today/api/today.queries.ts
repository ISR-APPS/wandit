// Reads of the home: the figures of the last 7 days and the check-ins per day.
// The home route prefetches them. TodayPage and the trend panel read them from the cache.
// The sample modules of ~/features/gym stand in for the tables. A later turn puts a Supabase read in each queryFn.
import { queryOptions } from "@tanstack/react-query";
import {
	activityOfDay,
	checkInsUntil,
	membersOfDay,
	startOfLocalDay,
} from "~/features/gym";
import { buildDailyCheckIns, buildWeekKpis } from "../lib/series";

/** The 4 figures of the home, the most important first. The key has no period: the window is always 7 days. */
export function weekKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => {
			const now = Date.now();
			const todayStart = startOfLocalDay(now);
			const activity = activityOfDay(todayStart);
			return buildWeekKpis(
				membersOfDay(todayStart),
				activity.sessions,
				checkInsUntil(activity, now),
				now,
			);
		},
	});
}

/** Check-ins per day for the last `days` days, with the same days one period earlier. Feeds the trend panel. */
export function dailyCheckInsQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["check-ins", "daily", days],
		queryFn: async () => {
			const now = Date.now();
			const todayStart = startOfLocalDay(now);
			return buildDailyCheckIns(
				checkInsUntil(activityOfDay(todayStart), now),
				todayStart,
				days,
			);
		},
	});
}
