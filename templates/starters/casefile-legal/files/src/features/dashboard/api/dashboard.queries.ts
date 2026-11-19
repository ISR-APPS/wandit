// Reads of the dashboard: the summary of one period, the hours per day of the hours card, and the deadlines.
// The /app route prefetches all three with the default periods. Another period loads in the page with useQuery.
// The queryFn returns sample rows today. A later turn replaces its body with a Supabase call (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables, type PeriodDays } from "~/features/practice";
import {
	buildDashboardSummary,
	buildUpcomingDeadlines,
	hoursPerDay,
} from "../lib/dashboard";

/** The first period of the page header. The kit opens its dashboards on about one month. */
export const DASHBOARD_DEFAULT_DAYS: PeriodDays = 30;

/** The first period of the hours card. Three months show the weekly rhythm of the firm, as the kit chart does. */
export const HOURS_DEFAULT_DAYS: PeriodDays = 90;

/** Every number of the dashboard for the last `days` days: target, KPIs, areas, stages, team. */
export function dashboardQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["dashboard", "summary", days],
		queryFn: async () => {
			const now = Date.now();
			return buildDashboardSummary(getSampleTables(now), days, now);
		},
	});
}

/** Billable and non-billable hours per day for the last `days` days. Feeds the hours card. */
export function hoursPerDayQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["time-entries", "per-day", days],
		queryFn: async () => {
			const now = Date.now();
			return hoursPerDay(getSampleTables(now), days, now);
		},
	});
}

/** Every upcoming deadline with its matter and client names, the soonest first. Feeds the deadline card. */
export function upcomingDeadlinesQueryOptions() {
	return queryOptions({
		queryKey: ["deadlines", "upcoming"],
		queryFn: async () => buildUpcomingDeadlines(getSampleTables()),
	});
}
