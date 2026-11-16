// The home behind login: the overview of the agency. The /app layout checks the session first.
// The loader fills the KPI figures, the leads per day of the first period, and the three lists of the home.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { leadsQueryOptions } from "~/features/leads";
import { listingsQueryOptions } from "~/features/listings";
import {
	DEFAULT_DAYS,
	dailyLeadsQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";
import { viewingsQueryOptions } from "~/features/viewings";

/** /app: the trend of the new leads, the newest listings, and the rail of work that needs a person. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailyLeadsQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(leadsQueryOptions()),
			context.queryClient.query(listingsQueryOptions()),
			context.queryClient.query(viewingsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
