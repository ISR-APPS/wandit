// The home behind login: the practice dashboard. The /app layout checks the session first.
// The loader fills the matter list, the summary, the hours, and the deadlines. Thin: the page lives in the dashboard feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DASHBOARD_DEFAULT_DAYS,
	DashboardPage,
	DashboardPageError,
	DashboardPageSkeleton,
	dashboardQueryOptions,
	HOURS_DEFAULT_DAYS,
	hoursPerDayQueryOptions,
	upcomingDeadlinesQueryOptions,
} from "~/features/dashboard";
import { mattersQueryOptions } from "~/features/matters";

/** /app: the figures of the period, the deadlines, the stages, and the active matters. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(mattersQueryOptions()),
			context.queryClient.query(dashboardQueryOptions(DASHBOARD_DEFAULT_DAYS)),
			context.queryClient.query(hoursPerDayQueryOptions(HOURS_DEFAULT_DAYS)),
			context.queryClient.query(upcomingDeadlinesQueryOptions()),
		]),
	pendingComponent: DashboardPageSkeleton,
	errorComponent: DashboardPageError,
	component: DashboardPage,
});
