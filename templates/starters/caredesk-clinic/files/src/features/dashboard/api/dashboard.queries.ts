// Reads of the home figures: the summary of one period, and the visits chart of one period and one department.
// The /app route loader prefetches the default period. DashboardPage reads the other periods after a change.
// Each queryFn reads the sample rows of ~/features/clinic. A later turn replaces the body with SQL read functions.
import { queryOptions } from "@tanstack/react-query";
import {
	LIVE_REFETCH_MS,
	listAppointmentRows,
	type PeriodDays,
	startOfMinute,
} from "~/features/clinic";
import {
	buildSummary,
	buildVisitSeries,
	type DepartmentFilter,
} from "../lib/summary";

/** The period of the first load of the home, in days. */
export const DASHBOARD_DEFAULT_DAYS = 30 satisfies PeriodDays;

/** The home figures of the last `days` days. The key holds the period, so each period has its own cache entry. */
export function dashboardQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["dashboard", "summary", days],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			return buildSummary(listAppointmentRows(now), days, now);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}

/** The visits of one department, split into women, men, and children. One point holds 1, 5, or 15 days (see visitBucketDays). */
export function visitSeriesQueryOptions(
	days: PeriodDays,
	department: DepartmentFilter,
) {
	return queryOptions({
		queryKey: ["dashboard", "visits", days, department],
		queryFn: async () => {
			const now = startOfMinute(Date.now());
			return buildVisitSeries(listAppointmentRows(now), days, department, now);
		},
		refetchInterval: LIVE_REFETCH_MS,
	});
}
