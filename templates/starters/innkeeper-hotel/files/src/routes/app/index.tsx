// The home behind login: the front desk. The /app layout checks the session first.
// The loader fills the summary of today, the occupancy of this week, and the revenue of the last 7 days.
// Thin: the page and its states live in the front-desk feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	FrontDeskPage,
	FrontDeskPageError,
	FrontDeskPageSkeleton,
	frontDeskQueryOptions,
	occupancyQueryOptions,
	revenueQueryOptions,
} from "~/features/front-desk";

/** /app. The week 0 and the period "week" are the first choices of the occupancy and revenue cards. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(frontDeskQueryOptions()),
			context.queryClient.query(occupancyQueryOptions(0)),
			context.queryClient.query(revenueQueryOptions("week")),
		]),
	pendingComponent: FrontDeskPageSkeleton,
	errorComponent: FrontDeskPageError,
	component: FrontDeskPage,
});
