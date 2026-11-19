// The home behind login: the campaign overview. The /app layout checks the session first.
// The loader fills every home query of the first period. Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { audiencesQueryOptions } from "~/features/audiences";
import { contentItemsQueryOptions } from "~/features/calendar";
import { campaignsQueryOptions } from "~/features/campaigns";
import {
	monthlySpendQueryOptions,
	OVERVIEW_DEFAULT_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
	weekReportQueryOptions,
} from "~/features/overview";

/** /app: the stat row, the 7-day report, content readiness, and the cards of the period. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewQueryOptions(OVERVIEW_DEFAULT_DAYS)),
			context.queryClient.query(weekReportQueryOptions()),
			context.queryClient.query(monthlySpendQueryOptions()),
			context.queryClient.query(campaignsQueryOptions()),
			context.queryClient.query(audiencesQueryOptions()),
			context.queryClient.query(contentItemsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
