// The home behind login: the digest of the school. The /app layout checks the session first.
// The loader fills the series of the default period and the lists. Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { submissionsQueryOptions } from "~/features/assignments";
import {
	courseActivityQueryOptions,
	DEFAULT_DAYS,
	dailyEnrollmentsQueryOptions,
	dailyLessonsQueryOptions,
	newestEnrollmentsQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
} from "~/features/overview";

/** /app: the last days of the school in one column. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(dailyLessonsQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(courseActivityQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(dailyEnrollmentsQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(newestEnrollmentsQueryOptions()),
			context.queryClient.query(submissionsQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
