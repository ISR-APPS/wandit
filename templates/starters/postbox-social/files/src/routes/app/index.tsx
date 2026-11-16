// The home behind login: the social overview. The /app layout checks the session first.
// The loader fills the figures, the trend, the channel ranking, and the post list of the first period.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	dailyImpressionsQueryOptions,
	engagementsByChannelQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";
import { postsQueryOptions } from "~/features/posts";
import { DEFAULT_DAYS } from "~/features/social";

/** /app: impressions, engagement, followers, and the latest posts of all channels. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(
				dailyImpressionsQueryOptions(DEFAULT_DAYS, "all"),
			),
			context.queryClient.query(engagementsByChannelQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(postsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
