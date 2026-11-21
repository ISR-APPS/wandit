// The read of the home summary for one period: the KPIs, the check-ins chart, the plan mix, and the sign-ups.
// The /app loader prefetches the default period. DashboardPage reads the chosen period with useQuery.
// The sample modules of ~/features/gym stand in for the tables. A later turn puts SQL read functions in the queryFn.
import { queryOptions } from "@tanstack/react-query";
import {
	activityOfDay,
	checkInsUntil,
	membersOfDay,
	type PeriodDays,
	startOfLocalDay,
} from "~/features/gym";
import { buildDashboardSummary } from "../lib/summary";

/** The period of the first load: 30 days shows a month of habits. */
export const DASHBOARD_DEFAULT_DAYS: PeriodDays = 30;

/** The summary of the last `days` days. The period is in the key, so each period has its own cache entry. */
export function dashboardQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["dashboard", days],
		queryFn: async () => {
			const now = Date.now();
			const todayStart = startOfLocalDay(now);
			const activity = activityOfDay(todayStart);
			return buildDashboardSummary(
				membersOfDay(todayStart),
				activity.sessions,
				checkInsUntil(activity, now),
				now,
				days,
			);
		},
	});
}
