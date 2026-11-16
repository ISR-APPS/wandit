// The home behind login: the product overview. The /app layout checks the session first.
// The loader fills the figures, the trend, the feature ranking, and the account list of the first period.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { accountsQueryOptions } from "~/features/accounts";
import {
	dailyActivePeopleQueryOptions,
	featureAdoptionQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
} from "~/features/overview";
import { DEFAULT_DAYS } from "~/features/tracking";

/** /app: active people, sign-ups, feature use, and the newest accounts. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(dailyActivePeopleQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(featureAdoptionQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(accountsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
