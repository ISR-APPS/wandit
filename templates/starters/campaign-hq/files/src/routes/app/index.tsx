// The home behind login: the campaign overview. The /app layout checks the session first.
// The loader fills every home query of the first period. Thin: the page lives in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	campaignsQueryOptions,
	recentCampaignEventsQueryOptions,
} from "~/features/campaigns";
import {
	conversionsByChannelQueryOptions,
	DEFAULT_DAYS,
	KPI_DAYS,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
	spendByChannelQueryOptions,
} from "~/features/overview";

/** /app: conversions, spend by channel, campaign status, the daily trend, and the latest activity. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(spendByChannelQueryOptions(KPI_DAYS)),
			context.queryClient.query(conversionsByChannelQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(campaignsQueryOptions()),
			context.queryClient.query(recentCampaignEventsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
