// The home behind login: the overview of the practice. The /app layout checks the session first.
// The loader fills the appointment book and the figures of the first period.
// Thin: the page and its states live in the dashboard feature.
import { createFileRoute } from "@tanstack/react-router";
import { appointmentsQueryOptions } from "~/features/appointments";
import {
	DASHBOARD_DEFAULT_DAYS,
	DashboardPage,
	DashboardPageError,
	DashboardPageSkeleton,
	dashboardQueryOptions,
} from "~/features/dashboard";

/** /app. The period select of the page loads the other periods. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(appointmentsQueryOptions()),
			context.queryClient.query(dashboardQueryOptions(DASHBOARD_DEFAULT_DAYS)),
		]),
	pendingComponent: DashboardPageSkeleton,
	errorComponent: DashboardPageError,
	component: DashboardPage,
});
