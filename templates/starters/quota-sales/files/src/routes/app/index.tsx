// The home of the area behind login. The /app layout checks the session first.
// The loader fills the KPI, trend, breakdown, and orders caches. Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { ordersQueryOptions } from "~/features/orders";
import {
	DEFAULT_DAYS,
	dailyBookingsQueryOptions,
	KPI_WINDOW_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
	territoryBookingsQueryOptions,
} from "~/features/overview";

/** /app: the sales overview. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailyBookingsQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(territoryBookingsQueryOptions(KPI_WINDOW_DAYS)),
			context.queryClient.query(ordersQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
