// The home behind login: the overview of the agency. The /app layout checks the session first.
// The loader fills the home summary and the lead, listing, and viewing rows that the cards list.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { leadsQueryOptions } from "~/features/leads";
import { listingsQueryOptions } from "~/features/listings";
import {
	homeSummaryQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
} from "~/features/overview";
import { viewingsQueryOptions } from "~/features/viewings";

/** /app: the KPIs, the performance chart, the featured listing, the leads, the active listings, and the calendar. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(homeSummaryQueryOptions()),
			context.queryClient.query(leadsQueryOptions()),
			context.queryClient.query(listingsQueryOptions()),
			context.queryClient.query(viewingsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
