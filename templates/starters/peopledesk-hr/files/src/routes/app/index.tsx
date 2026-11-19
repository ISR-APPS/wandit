// The home behind login: the HR dashboard. The /app layout checks the session first.
// The loader fills the employee list, the request list, and the summary of the default period in parallel.
// Thin: the page and its states live in the dashboard feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DASHBOARD_DEFAULT_DAYS,
	DashboardPage,
	DashboardPageError,
	DashboardPageSkeleton,
	dashboardQueryOptions,
} from "~/features/dashboard";
import { employeesQueryOptions } from "~/features/employees";
import { timeOffRequestsQueryOptions } from "~/features/time-off";

/** /app: the KPIs, the joiners, the hiring funnel, the teams, the leave calendar, and the upcoming time off. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(employeesQueryOptions()),
			context.queryClient.query(timeOffRequestsQueryOptions()),
			context.queryClient.query(dashboardQueryOptions(DASHBOARD_DEFAULT_DAYS)),
		]),
	pendingComponent: DashboardPageSkeleton,
	errorComponent: DashboardPageError,
	component: DashboardPage,
});
