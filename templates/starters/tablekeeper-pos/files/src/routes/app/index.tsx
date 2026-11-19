// The home behind login: the sales overview. The /app layout checks the session first.
// The loader fills the totals of today, the floor board, the checks of the day, and the sales of the first period.
// Thin: the page and its states live in the dashboard feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DashboardPage,
	DashboardPageError,
	DashboardPageSkeleton,
	DEFAULT_DAYS,
	salesByDayQueryOptions,
} from "~/features/dashboard";
import {
	dayTotalsQueryOptions,
	floorQueryOptions,
	ordersQueryOptions,
} from "~/features/restaurant";

/** /app: the sales of the period, the figures of today, the best sellers, and the checks of the day. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(dayTotalsQueryOptions()),
			context.queryClient.query(floorQueryOptions()),
			context.queryClient.query(ordersQueryOptions()),
			context.queryClient.query(salesByDayQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: DashboardPageSkeleton,
	errorComponent: DashboardPageError,
	component: DashboardPage,
});
