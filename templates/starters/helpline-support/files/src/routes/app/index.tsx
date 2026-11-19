// The home behind login: the dashboard of the support desk. The /app layout checks the session first.
// The loader fills the ticket list and the summary of the default period.
// Thin: the page and its states live in the dashboard feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DASHBOARD_DEFAULT_DAYS,
	DashboardPage,
	DashboardPageError,
	DashboardPageSkeleton,
	dashboardQueryOptions,
} from "~/features/dashboard";
import { ticketsQueryOptions } from "~/features/tickets";

/** /app: four KPIs, created against solved, tickets by channel, agent workload, and the urgent tickets. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(ticketsQueryOptions()),
			context.queryClient.query(dashboardQueryOptions(DASHBOARD_DEFAULT_DAYS)),
		]),
	pendingComponent: DashboardPageSkeleton,
	errorComponent: DashboardPageError,
	component: DashboardPage,
});
