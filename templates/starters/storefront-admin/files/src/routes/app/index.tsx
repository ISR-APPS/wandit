// The home behind login: the shop overview. The /app layout checks the session first.
// The loader fills the order list and the two home queries of the first period. Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { ordersQueryOptions } from "~/features/orders";
import {
	DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
	revenuePerDayQueryOptions,
} from "~/features/overview";

/** /app: the revenue of the period, four figures, and the orders to ship. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(ordersQueryOptions()),
			context.queryClient.query(revenuePerDayQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(overviewKpisQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
