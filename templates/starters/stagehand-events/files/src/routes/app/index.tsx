// The home of the box office behind login. The /app layout checks the session first.
// The loader fills the hero, the facts, and the next events in parallel. Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DEFAULT_DAYS,
	dailyRevenueQueryOptions,
	nextEventsQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
	todaySalesQueryOptions,
} from "~/features/overview";

/** /app: ticket revenue, today so far, the facts of the last 30 full days, and the next events. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(dailyRevenueQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(nextEventsQueryOptions()),
			context.queryClient.query(todaySalesQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
