// The home behind login: the social overview. The /app layout checks the session first.
// The loader fills the overview of the first period. Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
} from "~/features/overview";
import { DEFAULT_DAYS } from "~/features/social";

/** /app: followers, engagement, reach, the queue, and the channels of the brand. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		context.queryClient.query(overviewQueryOptions(DEFAULT_DAYS)),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
