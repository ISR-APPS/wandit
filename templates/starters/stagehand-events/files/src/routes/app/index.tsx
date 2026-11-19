// The home of the box office behind login. The /app layout checks the session first.
// The loader fills the summary of the default period, the events, and the newest orders in parallel.
// Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { eventsQueryOptions } from "~/features/events";
import {
	DEFAULT_DAYS,
	homeSummaryQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	recentOrdersQueryOptions,
} from "~/features/overview";

/** /app: the KPIs and charts of the last 30 days, the newest orders, the calendar, and the events ahead. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(homeSummaryQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(eventsQueryOptions()),
			context.queryClient.query(recentOrdersQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
