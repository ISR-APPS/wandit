// Reads of the home page: the appointments of today, the figures of the last 7 days, and the visits per day.
// The loader of the /app route prefetches them. TodayPage reads them from the cache.
// Each queryFn returns sample rows of ~/features/clinic. To make it real: replace the body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	addDays,
	LIVE_REFETCH_MS,
	listAppointmentRows,
	listPatients,
	rowsOfDay,
	startOfLocalDay,
	startOfMinute,
} from "~/features/clinic";
import { buildDailyVisits, buildWeekKpis } from "../lib/series";

/** The appointments of today with patient and practitioner, by start time. It refetches every 60 s. */
export function todayAppointmentsQueryOptions() {
	return queryOptions({
		queryKey: ["appointments", "today"],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			const todayStart = startOfLocalDay(now);
			return rowsOfDay(
				listAppointmentRows(now),
				todayStart,
				addDays(todayStart, 1),
			);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** The 4 figures of the last 7 days, each with its change against the 7 days before. The key has no period. */
export function weekKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			return buildWeekKpis(listAppointmentRows(now), listPatients(now), now);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** Visits done per day for the last `days` days, with the same days one period earlier. Feeds the trend panel. */
export function dailyVisitsQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["visits", "daily", days],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			return buildDailyVisits(listAppointmentRows(now), days, now);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
