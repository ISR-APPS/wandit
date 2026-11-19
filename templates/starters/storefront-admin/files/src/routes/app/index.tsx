// The home behind login: the shop dashboard. The /app layout checks the session first.
// The loader fills the order list and the summary of the first period. Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { ordersQueryOptions } from "~/features/orders";
import {
	DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
} from "~/features/overview";

/** /app: the best day, three stat cards, the revenue charts, the region, category, and delivery cards, and two tables. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(ordersQueryOptions()),
			context.queryClient.query(overviewQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
