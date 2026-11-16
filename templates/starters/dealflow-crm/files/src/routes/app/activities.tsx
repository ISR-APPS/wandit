// The activities page behind login. The /app layout checks the session first.
// The loader fills the log, the trend of the first period, the breakdown, and the open tasks in parallel.
// Thin: the page and its states live in the activities feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ACTIVITY_DEFAULT_DAYS,
	ActivitiesPage,
	ActivitiesPageError,
	ActivitiesPageSkeleton,
	activitiesQueryOptions,
	activityBreakdownQueryOptions,
	dailyActivitiesQueryOptions,
	openTasksQueryOptions,
} from "~/features/activities";

/** /app/activities: the logged calls, emails, meetings, and notes, and the follow-up tasks. */
export const Route = createFileRoute("/app/activities")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(activitiesQueryOptions(ACTIVITY_DEFAULT_DAYS)),
			context.queryClient.query(
				dailyActivitiesQueryOptions(ACTIVITY_DEFAULT_DAYS),
			),
			context.queryClient.query(
				activityBreakdownQueryOptions(ACTIVITY_DEFAULT_DAYS),
			),
			context.queryClient.query(openTasksQueryOptions()),
		]),
	pendingComponent: ActivitiesPageSkeleton,
	errorComponent: ActivitiesPageError,
	component: ActivitiesPage,
});
