// The home behind login: the CRM dashboard. The /app layout checks the session first.
// The loader fills the deal list, the summary of the default period, and the open tasks in parallel.
// Thin: the page and its states live in the dashboard feature.
import { createFileRoute } from "@tanstack/react-router";
import { openTasksQueryOptions } from "~/features/activities";
import {
	DASHBOARD_DEFAULT_DAYS,
	DashboardPage,
	DashboardPageError,
	DashboardPageSkeleton,
	dashboardQueryOptions,
} from "~/features/dashboard";
import { dealsQueryOptions } from "~/features/deals";

/** /app: the KPIs, the deal sources, the follow-ups, the pipeline, and the deals that need attention. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(dealsQueryOptions()),
			context.queryClient.query(dashboardQueryOptions(DASHBOARD_DEFAULT_DAYS)),
			context.queryClient.query(openTasksQueryOptions()),
		]),
	pendingComponent: DashboardPageSkeleton,
	errorComponent: DashboardPageError,
	component: DashboardPage,
});
