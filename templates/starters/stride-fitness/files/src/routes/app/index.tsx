// The home behind login: the dashboard of the gym. The /app layout checks the session first.
// The loader fills the summary of the default period, the member list, and the classes ahead.
// Thin: the page and its states live in the dashboard feature.
import { createFileRoute } from "@tanstack/react-router";
import { classSessionsQueryOptions } from "~/features/classes";
import {
	DASHBOARD_DEFAULT_DAYS,
	DashboardPage,
	DashboardPageError,
	DashboardPageSkeleton,
	dashboardQueryOptions,
} from "~/features/dashboard";
import { membersQueryOptions } from "~/features/members";

/** /app. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(dashboardQueryOptions(DASHBOARD_DEFAULT_DAYS)),
			context.queryClient.query(membersQueryOptions()),
			context.queryClient.query(classSessionsQueryOptions()),
		]),
	pendingComponent: DashboardPageSkeleton,
	errorComponent: DashboardPageError,
	component: DashboardPage,
});
